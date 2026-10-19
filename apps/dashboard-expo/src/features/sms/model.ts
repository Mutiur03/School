/**
 * Pure helpers for SMS management (dashboard/src/pages/Admin/SmsManagement.tsx and
 * dashboard/src/lib/sms.ts). The SMS segment counter (`calculateSMSCount`) and the phone regex
 * come from @school/shared-schemas; they are passed in so this file stays importable by tests.
 */
import type { SmsCategory, SmsLog, SmsSettings, SmsStatus } from '@/lib/api';

export type SmsCounter = (text: string) => {
  count: number;
  encoding: 'GSM-7' | 'Unicode';
  length: number;
};

export type TemplateField = 'present_template' | 'absent_template' | 'run_awayed_template';
export type TemplateToggle = 'send_to_present' | 'send_to_absent' | 'send_to_run_awayed';

export const TEMPLATES: readonly {
  field: TemplateField;
  toggle: TemplateToggle;
  title: string;
  description: string;
  dot: string;
}[] = [
  {
    field: 'present_template',
    toggle: 'send_to_present',
    title: 'Present',
    description: 'Sent when a student is marked present.',
    dot: 'bg-emerald-500',
  },
  {
    field: 'absent_template',
    toggle: 'send_to_absent',
    title: 'Absent',
    description: 'Sent when a student is marked absent.',
    dot: 'bg-red-500',
  },
  {
    field: 'run_awayed_template',
    toggle: 'send_to_run_awayed',
    title: 'Ran away',
    description: 'Sent from the Running away page.',
    dot: 'bg-amber-500',
  },
];

export const CORE_TOKENS = ['{student_name}'] as const;

export const ELECTIVE_TOKENS = [
  { id: '{login_id}', label: 'Login ID' },
  { id: '{date}', label: 'Date' },
  { id: '{school_name}', label: 'School name' },
  { id: '{class}', label: 'Class' },
  { id: '{section}', label: 'Section' },
  { id: '{roll}', label: 'Roll' },
] as const;

export const CATEGORY_LABELS: Record<SmsCategory, string> = {
  attendance: 'Attendance',
  password_reset: 'Password reset',
  test: 'Test',
  bulk: 'Bulk',
};

export const STATUS_LABELS: Record<SmsStatus, string> = {
  sent: 'Sent',
  failed: 'Failed',
  pending: 'Pending',
};

export const BULK_CLASSES = [6, 7, 8, 9, 10] as const;

export interface SmsTemplateValues {
  student_name?: string;
  login_id?: string | number;
  date?: string;
  class?: string | number;
  section?: string;
  roll?: string | number;
  school_name?: string;
}

/** Typical values for estimating one attendance SMS (a Bangla name switches to Unicode). */
export const SAMPLE_SMS_VALUES: SmsTemplateValues = {
  student_name: 'Md. Abdullah Al Mamun',
  login_id: '26100045',
  date: '04/10/2026',
  class: '10',
  section: 'A',
  roll: '45',
};

/** Same substitutions as the server's interpolate(). */
export const fillSmsTemplate = (template: string, v: SmsTemplateValues) =>
  template
    .replace(/{student_name}/g, v.student_name ?? '')
    .replace(/{login_id}/g, String(v.login_id ?? ''))
    .replace(/{date}/g, v.date ?? '')
    .replace(/{class}/g, String(v.class ?? ''))
    .replace(/{section}/g, v.section ?? '')
    .replace(/{roll}/g, String(v.roll ?? ''))
    .replace(/{school_name}/g, v.school_name ?? '');

export function validateTemplate(template: string, required: readonly string[]) {
  const allRequired = [...CORE_TOKENS, ...required];
  const missing = allRequired.filter((t) => !template.includes(t));
  const forbidden = ELECTIVE_TOKENS.map((t) => t.id as string).filter(
    (t) => !required.includes(t) && template.includes(t),
  );
  return {
    missing,
    forbidden,
    isValid: template.trim().length > 0 && missing.length === 0 && forbidden.length === 0,
  };
}

/** Error under a template, only when the master switch and that template's Send are on. */
export function templateError(
  t: { field: TemplateField; toggle: TemplateToggle },
  draft: SmsSettings,
  required: readonly string[],
): string | undefined {
  if (!draft.is_active || !draft[t.toggle]) return undefined;
  const text = draft[t.field] || '';
  const v = validateTemplate(text, required);
  if (v.isValid) return undefined;
  if (!text.trim()) return 'Message is empty.';
  const parts: string[] = [];
  if (v.missing.length) parts.push(`add ${v.missing.join(', ')}`);
  if (v.forbidden.length) parts.push(`remove ${v.forbidden.join(', ')}`);
  return `To save: ${parts.join(' and ')}.`;
}

export function settingsErrors(draft: SmsSettings, required: readonly string[]) {
  const out: Partial<Record<TemplateField, string>> = {};
  for (const t of TEMPLATES) {
    const e = templateError(t, draft, required);
    if (e) out[t.field] = e;
  }
  return out;
}

/** Electives already used by the saved templates start ticked. */
export const initialRequired = (s: SmsSettings) => {
  const all = s.present_template + s.absent_template + s.run_awayed_template;
  return ELECTIVE_TOKENS.map((t) => t.id as string).filter((t) => all.includes(t));
};

/** "≈ 2 credits per student · 148 chars · GSM-7"; '' for empty text. */
export function estimateLine(text: string, counter: SmsCounter, suffix = ''): string {
  if (!text) return '';
  const { count, length, encoding } = counter(text);
  return `≈ ${count} credit${count === 1 ? '' : 's'}${suffix} · ${length} chars · ${encoding}`;
}

export function testSmsErrors(phone: string, message: string, phoneRe: RegExp) {
  const p = phone.replace(/\s+/g, '');
  const errors: { phoneNumber?: string; message?: string } = {};
  if (!p) errors.phoneNumber = 'Phone number is required.';
  else if (!phoneRe.test(p)) errors.phoneNumber = 'Phone must be 11 digits and start with 01.';
  if (!message.trim()) errors.message = 'Message is required.';
  return { phone: p, message: message.trim(), errors };
}

/** Selected rows that may be retried (anything not already sent). */
export const retryableIds = (logs: readonly SmsLog[], selected: ReadonlySet<number>) =>
  logs.filter((l) => selected.has(l.id) && l.status !== 'sent').map((l) => l.id);

export function bulkCost(
  withPhone: number,
  text: string,
  counter: SmsCounter,
  balance: number | null,
) {
  const per = text ? counter(text).count : 0;
  const credits = withPhone * per;
  return { per, credits, tooExpensive: balance != null && credits > balance };
}

/** `YYYY-MM-DD` → `DD/MM/YYYY` (the web page's date label). */
export const displayDate = (ymd: string) => {
  const [y, m, d] = ymd.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : ymd;
};

/** A log's day: the attendance date, else the local day it was sent. */
export function logDay(log: Pick<SmsLog, 'attendance_date' | 'created_at'>): string {
  if (log.attendance_date) return displayDate(log.attendance_date);
  const t = Date.parse(log.created_at);
  if (Number.isNaN(t)) return '—';
  const d = new Date(t);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function typeSummary(categories: readonly SmsCategory[]): string {
  const all = Object.keys(CATEGORY_LABELS).length;
  return categories.length === 0 || categories.length === all
    ? 'All types'
    : categories.map((c) => CATEGORY_LABELS[c]).join(', ');
}

/** Ticked filter values as the sms-logs query takes them: a comma list, or 'all' when none. */
export const listParam = (values: readonly string[]): string =>
  values.length ? values.join(',') : 'all';
