import { prisma } from '@/config/prisma.js';
import { getRlsContext } from '@/config/rlsContextStore.js';
import { ApiError } from '@/utils/ApiError.js';
import { DEFAULT_SMS_TEMPLATES } from '@/constants/smsTemplates.js';
import { getProviderAdapter } from '@/utils/sms-providers/index.js';
import { encryptSecret, decryptSecret, maskSecret } from '@/utils/crypto.js';
import { SMSService, isSelfHosted } from '@/utils/sms.service.js';

export class SmsSettingsService {
  private static requireSchoolId(): number {
    const { schoolId } = getRlsContext() ?? {};
    if (!Number.isInteger(schoolId)) {
      throw new ApiError(400, 'School context missing');
    }
    return schoolId as number;
  }

  static async getSettings() {
    const schoolId = this.requireSchoolId();
    let settings = await prisma.sms_settings.findUnique({
      where: { school_id: schoolId },
    });
    if (!settings) {
      settings = await prisma.sms_settings.create({
        data: {
          ...DEFAULT_SMS_TEMPLATES,
          school_id: schoolId,
        },
      });
    }
    return settings;
  }

  static async updateSettings(data: any) {
    const settings = await this.getSettings();

    // Extract requiredPlaceholders from data if present
    const { requiredPlaceholders, ...updateData } = data;

    // Validate templates if they are being updated
    if (updateData.present_template) {
      this.validateTemplate(
        updateData.present_template,
        'Present Notification',
        requiredPlaceholders,
      );
    }
    if (updateData.absent_template) {
      this.validateTemplate(
        updateData.absent_template,
        'Absent Notification',
        requiredPlaceholders,
      );
    }
    if (updateData.run_awayed_template) {
      this.validateTemplate(
        updateData.run_awayed_template,
        'Run Awayed Notification',
        requiredPlaceholders,
      );
    }

    // Restricted fields (credentials/provider) can only be set via the
    // super_admin-only /api/schools/:id/sms-credentials endpoint (see updateCredentials).
    const { api_key, api_url, sender_id, service_type, sms_balance, ...safeData } = updateData;

    return await prisma.sms_settings.update({
      where: { id: settings.id },
      data: safeData,
    });
  }

  /**
   * Super-admin only: get/set a specific school's SMS credentials & provider,
   * addressed directly by school_id (no tenant/RLS context required).
   * The API key is stored encrypted and is never returned in plaintext here —
   * only a masked preview, so it round-trips through the UI safely.
   */
  static async getCredentialsForSchool(schoolId: number) {
    let settings = await prisma.sms_settings.findUnique({ where: { school_id: schoolId } });
    if (!settings) {
      settings = await prisma.sms_settings.create({
        data: { ...DEFAULT_SMS_TEMPLATES, school_id: schoolId },
      });
    }
    const balanceResult = await SMSService.getBalanceForSettings(settings);
    return {
      api_key_masked: settings.api_key ? maskSecret(decryptSecret(settings.api_key)) : null,
      api_url: settings.api_url,
      sender_id: settings.sender_id,
      service_type: settings.service_type,
      estimated_sms: balanceResult.data?.estimatedSms ?? null,
      balance_message: balanceResult.message,
    };
  }

  static async updateCredentialsForSchool(
    schoolId: number,
    data: { api_key?: string | null; api_url?: string; sender_id?: string; service_type?: string },
  ) {
    if (data.service_type) {
      getProviderAdapter(data.service_type); // throws if unrecognized
    }

    const existing = await prisma.sms_settings.findUnique({ where: { school_id: schoolId } });
    if (!existing) {
      await prisma.sms_settings.create({ data: { ...DEFAULT_SMS_TEMPLATES, school_id: schoolId } });
    }

    // api_key omitted/undefined: leave the stored key unchanged (the UI never sees the
    // plaintext to send back). api_key === null: explicitly clear it (switch to shared
    // account). A non-empty string: set a new key (self-host with this key).
    const { api_key, ...rest } = data;
    let updateData: Record<string, unknown> = rest;
    if (api_key === null) {
      updateData = { ...rest, api_key: null };
    } else if (api_key) {
      updateData = { ...rest, api_key: encryptSecret(api_key) };
    }

    await prisma.sms_settings.update({
      where: { school_id: schoolId },
      data: updateData,
    });
    return this.getCredentialsForSchool(schoolId);
  }

  /** Sends a test SMS and records it in sms_logs (category 'test', no student). */
  static async sendTestSms(phoneNumber: string, message: string) {
    const result = await SMSService.sendTestSMS(phoneNumber, message);
    await prisma.sms_logs
      .create({
        data: {
          category: 'test',
          phone_number: phoneNumber,
          message,
          status: result.success ? 'sent' : 'failed',
          error_reason: result.success ? null : result.message,
        },
      })
      .catch((e) => console.error('Failed to write sms_logs entry:', e));
    return result;
  }

  /**
   * Super-admin only: system-wide SMS overview — the shared account's live balance,
   * plus every school's mode (self-hosted vs shared) and estimated SMS remaining.
   */
  static async getOverview() {
    const [systemBalance, schools] = await Promise.all([
      SMSService.getSystemBalance(),
      prisma.school.findMany({
        select: {
          id: true,
          name: true,
          logo: true,
          sms_settings: {
            select: {
              api_key: true,
              api_url: true,
              service_type: true,
              sender_id: true,
              sms_balance: true,
              is_active: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    const schoolRows = await Promise.all(
      schools.map(async (school) => {
        const settings = school.sms_settings;
        if (!settings) {
          return {
            school_id: school.id,
            school_name: school.name,
            logo: school.logo,
            configured: false,
            self_hosted: false,
            is_active: false,
            service_type: null,
            sender_id: null,
            estimated_sms: null,
            balance_message: 'No SMS settings yet',
          };
        }
        const balance = await SMSService.getBalanceForSettings(settings);
        return {
          school_id: school.id,
          school_name: school.name,
          logo: school.logo,
          configured: true,
          self_hosted: isSelfHosted(settings),
          is_active: settings.is_active,
          service_type: settings.service_type,
          sender_id: settings.sender_id,
          estimated_sms: balance.data?.estimatedSms ?? null,
          balance_message: balance.message,
        };
      }),
    );

    return {
      system: {
        estimated_sms: systemBalance.data?.estimatedSms ?? null,
        message: systemBalance.message,
      },
      schools: schoolRows,
    };
  }

  private static validateTemplate(template: string, name: string, requiredPlaceholders?: string[]) {
    // Always require {student_name}
    const coreRequired = ['{student_name}'];
    const electiveRequired = requiredPlaceholders || [];

    // Combine and deduplicate
    const allRequired = Array.from(new Set([...coreRequired, ...electiveRequired]));

    // Check for missing mandatory tokens
    const missing = allRequired.filter((p) => !template.includes(p));
    if (missing.length > 0) {
      throw new ApiError(
        400,
        `${name} template is missing mandatory placeholders: ${missing.join(', ')}`,
      );
    }

    // Check for forbidden tokens (those NOT in the required list)
    const allPossibleElectives = [
      '{login_id}',
      '{date}',
      '{school_name}',
      '{class}',
      '{section}',
      '{roll}',
    ];
    const forbidden = allPossibleElectives.filter(
      (p) => !allRequired.includes(p) && template.includes(p),
    );

    if (forbidden.length > 0) {
      throw new ApiError(
        400,
        `${name} template contains forbidden placeholders (they are unchecked in settings): ${forbidden.join(', ')}`,
      );
    }
  }

  /**
   * Internal use only (reserve/refund bookkeeping around a send) — no-op for self-hosted
   * schools since their balance lives at the provider, not in our DB.
   * For a super_admin manually crediting a school, use addBalanceForSchool instead.
   */
  static async updateBalance(amount: number) {
    const settings = await this.getSettings();
    if (isSelfHosted(settings)) return settings;
    return await prisma.sms_settings.update({
      where: { id: settings.id },
      data: {
        sms_balance: {
          increment: amount,
        },
      },
    });
  }

  /**
   * Super-admin only: manually credit a specific school's shared-account balance.
   * Blocked for self-hosted schools — their balance lives at the provider, top up there instead.
   */
  static async addBalanceForSchool(schoolId: number, amount: number) {
    const settings = await prisma.sms_settings.findUnique({ where: { school_id: schoolId } });
    if (!settings) throw new ApiError(404, 'SMS settings not found for this school');
    if (isSelfHosted(settings)) {
      throw new ApiError(
        400,
        'This school uses its own SMS provider account — top up balance directly with the provider, not here.',
      );
    }
    return await prisma.sms_settings.update({
      where: { id: settings.id },
      data: { sms_balance: { increment: amount } },
      select: { sms_balance: true },
    });
  }

  /**
   * Reserves an amount of credits atomically.
   * Returns true if successful, false if insufficient balance.
   * Self-hosted schools skip this gate entirely — the provider enforces its own balance.
   */
  static async reserveBalance(amount: number) {
    if (amount <= 0) return true;

    const settings = await this.getSettings();
    if (isSelfHosted(settings)) return true;

    const result = await prisma.sms_settings.updateMany({
      where: {
        id: settings.id,
        sms_balance: {
          gte: amount,
        },
      },
      data: {
        sms_balance: {
          decrement: amount,
        },
      },
    });

    return result.count > 0;
  }

  /** Live from the provider for self-hosted schools, tracked counter otherwise. */
  static async getBalance() {
    const settings = await this.getSettings();
    const result = await SMSService.getBalanceForSettings(settings);
    return {
      estimatedSms: result.data?.estimatedSms ?? null,
      message: result.message,
      selfHosted: isSelfHosted(settings),
    };
  }
}
