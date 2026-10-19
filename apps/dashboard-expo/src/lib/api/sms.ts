/**
 * SMS management, verified against server/src/modules/sms-logs/sms-logs.route.ts (all admin
 * only) and sms-settings/sms-settings.route.ts (admin, except /public for teachers too), and
 * dashboard/src/pages/Admin/SmsManagement.tsx:
 *
 *   GET    /api/sms/sms-logs?page&limit&category&status&date   raw JSON (no envelope):
 *          { smsLogs, totalCount, totalPages, currentPage, stats: { sent?, failed?, pending? } }
 *   GET    /api/sms/usage-stats?days=30          { stats: [{ date, count }] }
 *   POST   /api/sms/retry-sms { smsLogIds }       { message, stats }   (sends real SMS)
 *   DELETE /api/sms/sms-logs { smsLogIds }        { message }
 *   GET    /api/sms/student-count?classes=6,7     { totalStudents, withPhone, classBreakdown }
 *   POST   /api/sms/bulk-sms { classNames, message }  { successCount, failedCount } (real SMS)
 *   GET    /api/sms-settings                      envelope; templates + send_* flags + is_active
 *   PATCH  /api/sms-settings { ...templates/flags, requiredPlaceholders }
 *   GET    /api/sms-settings/balance              envelope; { estimatedSms, message, selfHosted }
 *   POST   /api/sms-settings/test { phoneNumber, message }   (real SMS, one credit)
 *
 * PATCH only ever sends the seven editable fields: the server forwards any other body key to the
 * database update (see docs/web-parity.md, SMS gaps). The school is never sent.
 */
import type { ApiClient } from './client';
import { bool, isObj, num, objArray, parseError, str, strOrNull } from './parse';

export type SmsCategory = 'attendance' | 'password_reset' | 'test' | 'bulk';
export type SmsStatus = 'sent' | 'failed' | 'pending';

export interface SmsLog {
  id: number;
  student: {
    name: string;
    login_id: string | null;
    enrollment: { class: number; section: string; roll: number } | null;
  } | null;
  phone_number: string;
  attendance_date: string | null;
  category: SmsCategory;
  status: SmsStatus;
  sms_count: number | null;
  retry_count: number;
  message: string;
  error_reason: string | null;
  created_at: string;
}

export interface SmsLogsPage {
  logs: SmsLog[];
  totalPages: number;
  totalCount: number;
  stats: { sent: number; failed: number; pending: number };
}

export interface SmsLogsParams {
  page: number;
  limit: number;
  /** Comma list or 'all'. */
  category: string;
  status: string;
  /** YYYY-MM-DD. */
  date: string;
}

export interface SmsSettings {
  present_template: string;
  absent_template: string;
  run_awayed_template: string;
  send_to_present: boolean;
  send_to_absent: boolean;
  send_to_run_awayed: boolean;
  is_active: boolean;
}

export interface SmsBalance {
  estimatedSms: number | null;
  message: string | null;
  selfHosted: boolean;
}

export interface SmsStudentCount {
  totalStudents: number;
  withPhone: number;
  classBreakdown: { cls: number; total: number; withPhone: number }[];
}

export const SMS_PATHS = {
  logs: '/api/sms/sms-logs',
  usage: '/api/sms/usage-stats',
  retry: '/api/sms/retry-sms',
  studentCount: '/api/sms/student-count',
  bulk: '/api/sms/bulk-sms',
  settings: '/api/sms-settings',
  balance: '/api/sms-settings/balance',
  test: '/api/sms-settings/test',
} as const;

const CATEGORIES: readonly SmsCategory[] = ['attendance', 'password_reset', 'test', 'bulk'];

/** The server stores 'success'/'delivered' for some providers; the page shows them as sent. */
export function normalizeSmsStatus(v: unknown): SmsStatus {
  const s = String(v ?? '').toLowerCase();
  if (s === 'sent' || s === 'success' || s === 'delivered') return 'sent';
  if (s === 'failed') return 'failed';
  return 'pending';
}

export function parseSmsLog(v: Record<string, unknown>): SmsLog {
  const st = isObj(v.student) ? v.student : null;
  const e =
    st && Array.isArray(st.enrollments) && isObj(st.enrollments[0]) ? st.enrollments[0] : null;
  return {
    id: num(v.id),
    student: st
      ? {
          name: str(st.name),
          login_id: strOrNull(st.login_id),
          enrollment: e
            ? { class: num(e.class), section: str(e.section), roll: num(e.roll) }
            : null,
        }
      : null,
    phone_number: str(v.phone_number),
    attendance_date: strOrNull(v.attendance_date),
    category: CATEGORIES.find((c) => c === v.category) ?? 'attendance',
    status: normalizeSmsStatus(v.status),
    sms_count: typeof v.sms_count === 'number' ? v.sms_count : null,
    retry_count: num(v.retry_count),
    message: str(v.message),
    error_reason: strOrNull(v.error_reason),
    created_at: str(v.created_at),
  };
}

export function parseSmsLogsPage(v: unknown): SmsLogsPage {
  if (!isObj(v) || !Array.isArray(v.smsLogs)) throw parseError(SMS_PATHS.logs);
  const stats = isObj(v.stats) ? v.stats : {};
  // Provider statuses are folded the same way as rows.
  const folded = { sent: 0, failed: 0, pending: 0 };
  for (const [k, n] of Object.entries(stats)) folded[normalizeSmsStatus(k)] += num(n);
  const logs = v.smsLogs.filter(isObj).map(parseSmsLog);
  return {
    logs,
    totalPages: Math.max(1, num(v.totalPages, 1)),
    totalCount: num(v.totalCount, logs.length),
    stats: folded,
  };
}

export function parseSmsSettings(v: unknown): SmsSettings {
  if (!isObj(v)) throw parseError(SMS_PATHS.settings);
  return {
    present_template: str(v.present_template),
    absent_template: str(v.absent_template),
    run_awayed_template: str(v.run_awayed_template),
    send_to_present: bool(v.send_to_present),
    send_to_absent: bool(v.send_to_absent),
    send_to_run_awayed: bool(v.send_to_run_awayed),
    is_active: bool(v.is_active),
  };
}

/** Only the editable fields, never anything else from the loaded row. */
export const settingsPatchBody = (s: SmsSettings, requiredPlaceholders: readonly string[]) => ({
  present_template: s.present_template,
  absent_template: s.absent_template,
  run_awayed_template: s.run_awayed_template,
  send_to_present: s.send_to_present,
  send_to_absent: s.send_to_absent,
  send_to_run_awayed: s.send_to_run_awayed,
  is_active: s.is_active,
  requiredPlaceholders: [...requiredPlaceholders],
});

export function parseBalance(v: unknown): SmsBalance {
  if (!isObj(v)) return { estimatedSms: null, message: null, selfHosted: false };
  return {
    estimatedSms: typeof v.estimatedSms === 'number' ? v.estimatedSms : null,
    message: strOrNull(v.message),
    selfHosted: bool(v.selfHosted),
  };
}

export function parseStudentCount(v: unknown): SmsStudentCount {
  if (!isObj(v)) throw parseError(SMS_PATHS.studentCount);
  const bd = isObj(v.classBreakdown) ? v.classBreakdown : {};
  return {
    totalStudents: num(v.totalStudents),
    withPhone: num(v.withPhone),
    classBreakdown: Object.entries(bd)
      .map(([cls, info]) => ({
        cls: Number(cls),
        total: isObj(info) ? num(info.total) : 0,
        withPhone: isObj(info) ? num(info.withPhone) : 0,
      }))
      .sort((a, b) => a.cls - b.cls),
  };
}

const message = (v: unknown, fallback: string) =>
  isObj(v) && typeof v.message === 'string' && v.message ? v.message : fallback;

export function createSmsApi(client: ApiClient) {
  return {
    async logs(p: SmsLogsParams, signal?: AbortSignal): Promise<SmsLogsPage> {
      const data = await client.get<unknown>(SMS_PATHS.logs, {
        query: {
          page: p.page,
          limit: p.limit,
          category: p.category,
          status: p.status,
          date: p.date,
        },
        signal,
      });
      return parseSmsLogsPage(data);
    },
    async usage(days = 30, signal?: AbortSignal): Promise<{ date: string; count: number }[]> {
      const data = await client.get<unknown>(SMS_PATHS.usage, { query: { days }, signal });
      const stats = isObj(data) ? data.stats : null;
      return objArray(stats ?? [], SMS_PATHS.usage).map((d) => ({
        date: str(d.date),
        count: num(d.count),
      }));
    },
    async retry(smsLogIds: number[]): Promise<string> {
      const data = await client.post<unknown>(SMS_PATHS.retry, { smsLogIds });
      return message(data, 'Retry started.');
    },
    async deleteLogs(smsLogIds: number[]): Promise<string> {
      const data = await client.request<unknown>(SMS_PATHS.logs, {
        method: 'DELETE',
        body: { smsLogIds },
      });
      return message(data, 'SMS logs deleted.');
    },
    async studentCount(classes: number[], signal?: AbortSignal): Promise<SmsStudentCount> {
      const data = await client.get<unknown>(SMS_PATHS.studentCount, {
        query: { classes: [...classes].sort((a, b) => a - b).join(',') },
        signal,
      });
      return parseStudentCount(data);
    },
    async sendBulk(classNames: number[], text: string): Promise<{ sent: number; failed: number }> {
      const data = await client.post<unknown>(SMS_PATHS.bulk, { classNames, message: text });
      return {
        sent: isObj(data) ? num(data.successCount) : 0,
        failed: isObj(data) ? num(data.failedCount) : 0,
      };
    },
    async settings(signal?: AbortSignal): Promise<SmsSettings> {
      return parseSmsSettings(await client.get<unknown>(SMS_PATHS.settings, { signal }));
    },
    async saveSettings(s: SmsSettings, requiredPlaceholders: readonly string[]): Promise<void> {
      await client.patch<unknown>(SMS_PATHS.settings, settingsPatchBody(s, requiredPlaceholders));
    },
    async balance(signal?: AbortSignal): Promise<SmsBalance> {
      return parseBalance(await client.get<unknown>(SMS_PATHS.balance, { signal }));
    },
    async sendTest(phoneNumber: string, text: string): Promise<void> {
      await client.post<unknown>(SMS_PATHS.test, { phoneNumber, message: text });
    },
  };
}

export type SmsApi = ReturnType<typeof createSmsApi>;
