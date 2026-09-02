import { env } from '@/config/env.js';
import { prisma } from '@/config/prisma.js';
import { getRlsContext } from '@/config/rlsContextStore.js';
import { calculateSMSCount } from '@school/shared-schemas';
import { DEFAULT_SMS_TEMPLATES } from '@/constants/smsTemplates.js';
import { getProviderAdapter } from '@/utils/sms-providers/index.js';
import { decryptSecret } from '@/utils/crypto.js';

export interface SMSMessage {
  Number: string;
  Text: string;
}

export interface SMSResponse {
  success: boolean;
  message?: string;
  data?: any;
}

export interface SMSOptions {
  skipBalanceUpdate?: boolean;
}

/** A school with its own api_key runs entirely on its own account: its own sender IDs,
 *  its own provider, its own balance. The shared .env credentials are never mixed in. */
export function isSelfHosted(settings: { api_key: string | null }): boolean {
  return !!settings.api_key;
}

export class SMSService {
  private static readonly FALLBACK_API_KEY = env.BULK_SMS_API_KEY;
  private static readonly FALLBACK_SENDER_IDS = (env.BULK_SMS_SENDER_IDS?.split(',') ?? [])
    .map((id) => id.trim())
    .filter(Boolean);

  private static parseSenderIds(raw?: string | null): string[] {
    return (raw?.split(',') ?? []).map((id) => id.trim()).filter(Boolean);
  }

  private static pickRandomSenderId(senderIds: string[]): string {
    return senderIds[Math.floor(Math.random() * senderIds.length)];
  }

  /** Resolves the api key, sender IDs, and provider to actually send with — either
   *  fully from the school's own settings, or fully from the shared system defaults.
   *  Never mixes the two. */
  private static resolveSendConfig(settings: {
    api_key: string | null;
    sender_id: string | null;
    api_url: string | null;
    service_type: string | null;
  }) {
    if (isSelfHosted(settings)) {
      const apiKey = decryptSecret(settings.api_key as string);
      const senderIds = this.parseSenderIds(settings.sender_id);
      if (senderIds.length === 0) {
        throw new Error(
          'This school has its own SMS API key configured but no sender ID — set one in SMS credentials.',
        );
      }
      return {
        selfHosted: true,
        apiKey,
        senderId: this.pickRandomSenderId(senderIds),
        apiUrl: settings.api_url,
        serviceType: settings.service_type,
      };
    }

    const senderIds = this.FALLBACK_SENDER_IDS;
    if (!this.FALLBACK_API_KEY || senderIds.length === 0) {
      throw new Error('SMS configuration missing in database and environment.');
    }
    return {
      selfHosted: false,
      apiKey: this.FALLBACK_API_KEY,
      senderId: this.pickRandomSenderId(senderIds),
      apiUrl: null as string | null,
      serviceType: null as string | null,
    };
  }

  public static formatPhoneNumber(phoneNumber: string): string {
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    if (cleanNumber.length === 11 && cleanNumber.startsWith('01')) {
      return `88${cleanNumber}`;
    }
    if (cleanNumber.length === 13 && cleanNumber.startsWith('8801')) {
      return cleanNumber;
    }
    // Fallback: if it's already 13 and looks like international, or if it's just 11
    return cleanNumber.startsWith('88') ? cleanNumber : `88${cleanNumber}`;
  }

  public static async getSettings() {
    const { schoolId } = getRlsContext() ?? {};
    if (!Number.isInteger(schoolId)) {
      throw new Error('School context missing for SMS settings');
    }

    let settings = await prisma.sms_settings.findUnique({
      where: { school_id: schoolId as number },
    });
    if (!settings) {
      settings = await prisma.sms_settings.create({
        data: {
          ...DEFAULT_SMS_TEMPLATES,
          school_id: schoolId as number,
        },
      });
    }
    return settings;
  }

  /**
   * Send a single SMS message
   */
  static async sendSMS(
    phoneNumber: string,
    message: string,
    options?: SMSOptions,
  ): Promise<SMSResponse> {
    const settings = await this.getSettings();
    const config = this.resolveSendConfig(settings);

    if (!config.selfHosted) {
      const calc = this.calculateSMSCount(message);
      if (settings.sms_balance < calc.count) {
        return {
          success: false,
          message: `Insufficient SMS balance. Needed: ${calc.count} credits, Available: ${settings.sms_balance}`,
        };
      }
    }

    const messageParameters: SMSMessage[] = [
      {
        Number: SMSService.formatPhoneNumber(phoneNumber),
        Text: message,
      },
    ];

    const adapter = getProviderAdapter(config.serviceType);
    const result = await adapter.send(messageParameters, {
      apiKey: config.apiKey,
      apiUrl: config.apiUrl,
      senderId: config.senderId,
    });

    if (result.success && !config.selfHosted && !options?.skipBalanceUpdate) {
      await prisma.sms_settings.update({
        where: { id: settings.id },
        data: {
          sms_balance: {
            decrement: result.unitsUsed || 1,
          },
        },
      });
    }

    return result;
  }

  /**
   * Send bulk SMS messages
   */
  static async sendBulkSMS(messages: SMSMessage[], options?: SMSOptions): Promise<SMSResponse> {
    const settings = await this.getSettings();
    const config = this.resolveSendConfig(settings);

    // Calculate aggregate segments needed for the ENTIRE batch
    let totalSegmentsNeeded = 0;
    for (const msg of messages) {
      const calc = this.calculateSMSCount(msg.Text);
      totalSegmentsNeeded += calc.count;
    }

    // Balance may already be reserved by the caller when skipBalanceUpdate is set
    if (
      !config.selfHosted &&
      !options?.skipBalanceUpdate &&
      settings.sms_balance < totalSegmentsNeeded
    ) {
      return {
        success: false,
        message: `Insufficient SMS balance. Needed: ${totalSegmentsNeeded} credits, Available: ${settings.sms_balance}`,
      };
    }

    const messageParameters = messages.map((msg) => ({
      Number: SMSService.formatPhoneNumber(msg.Number),
      Text: msg.Text,
    }));

    const adapter = getProviderAdapter(config.serviceType);
    const result = await adapter.send(messageParameters, {
      apiKey: config.apiKey,
      apiUrl: config.apiUrl,
      senderId: config.senderId,
    });

    if (result.success && !config.selfHosted && !options?.skipBalanceUpdate) {
      await prisma.sms_settings.update({
        where: { id: settings.id },
        data: {
          sms_balance: {
            decrement: result.unitsUsed || totalSegmentsNeeded,
          },
        },
      });
    }

    return result;
  }

  /** Live balance of the shared platform account (env credentials), independent of any school. */
  static async getSystemBalance(): Promise<SMSResponse> {
    if (!this.FALLBACK_API_KEY) {
      return {
        success: false,
        message: 'Shared SMS account is not configured (BULK_SMS_API_KEY missing).',
      };
    }
    const adapter = getProviderAdapter(null);
    if (!adapter.getBalance) {
      return { success: false, message: 'Balance check is not supported for this provider.' };
    }
    const result = await adapter.getBalance({ apiKey: this.FALLBACK_API_KEY, apiUrl: null });
    return {
      success: result.success,
      message:
        result.message ||
        (result.success ? 'Live balance from the shared provider account' : undefined),
      data: result.success ? { estimatedSms: result.estimatedSms } : undefined,
    };
  }

  /**
   * Get estimated SMS remaining — live from the provider for a self-hosted school,
   * from our tracked counter for schools on the shared system account.
   */
  static async getBalance(): Promise<SMSResponse> {
    const settings = await this.getSettings();
    return this.getBalanceForSettings(settings);
  }

  static async getBalanceForSettings(settings: {
    api_key: string | null;
    api_url: string | null;
    service_type: string | null;
    sms_balance: number;
  }): Promise<SMSResponse> {
    if (isSelfHosted(settings)) {
      const adapter = getProviderAdapter(settings.service_type);
      if (!adapter.getBalance) {
        return {
          success: false,
          message: 'Balance check is not supported for this provider.',
        };
      }
      const apiKey = decryptSecret(settings.api_key as string);
      const result = await adapter.getBalance({ apiKey, apiUrl: settings.api_url });
      return {
        success: result.success,
        message:
          result.message ||
          (result.success ? 'Estimated SMS remaining (from provider)' : undefined),
        data: result.success ? { estimatedSms: result.estimatedSms } : undefined,
      };
    }

    return {
      success: true,
      data: { estimatedSms: settings.sms_balance },
      message: 'Estimated SMS remaining (from database)',
    };
  }

  /**
   * Calculate SMS count based on text length and encoding
   */
  static calculateSMSCount(text: string): {
    count: number;
    encoding: 'GSM-7' | 'Unicode';
    length: number;
  } {
    return calculateSMSCount(text);
  }

  /**
   * Send a test SMS message
   */
  static async sendTestSMS(phoneNumber: string, message: string): Promise<SMSResponse> {
    const testMessage = `[TEST] School Management System: ${message}`;
    return this.sendSMS(phoneNumber, testMessage);
  }

  /**
   * Send password reset code
   */
  static async sendPasswordResetCode(
    phoneNumber: string,
    resetCode: string,
    recipientName?: string,
  ): Promise<SMSResponse> {
    const message = `School Management System: Your password reset code is: ${resetCode}. This code will expire in 15 minutes. If you didn't request this, please ignore this message.${recipientName ? ` - ${recipientName}` : ''}`;

    return this.sendSMS(phoneNumber, message);
  }

  // /**
  //  * Send verification code
  //  */
  // static async sendVerificationCode(phoneNumber: string, verificationCode: string, purpose: string): Promise<SMSResponse> {
  //   const message = `School Management System: Your ${purpose} verification code is: ${verificationCode}. This code will expire in 10 minutes. If you didn't request this, please ignore this message.`;

  //   return this.sendSMS(phoneNumber, message);
  // }

  // /**
  //  * Send general notification
  //  */
  // static async sendNotification(phoneNumber: string, notification: string): Promise<SMSResponse> {
  //   const message = `School Management System: ${notification}`;

  //   return this.sendSMS(phoneNumber, message);
  // }

  // /**
  //  * Validate phone number format (Bangladesh)
  //  */
  // static validatePhoneNumber(phoneNumber: string): boolean {
  //   // Remove any non-digit characters
  //   const cleanNumber = phoneNumber.replace(/\D/g, '');

  //   // Check if it's a valid Bangladesh number (11 digits starting with 01)
  //   return cleanNumber.length === 11 && cleanNumber.startsWith('01');
  // }

  // /**
  //  * Format phone number to standard format
  //  */
  // static formatPhoneNumber(phoneNumber: string): string {
  //   const cleanNumber = phoneNumber.replace(/\D/g, '');

  //   if (cleanNumber.length === 11 && cleanNumber.startsWith('01')) {
  //     return cleanNumber;
  //   }

  //   throw new Error('Invalid phone number format. Must be 11 digits starting with 01');
  // }
}
