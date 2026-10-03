import { calculateSMSCount } from '@school/shared-schemas';

export type SmsTemplateValues = {
  student_name?: string;
  login_id?: string | number;
  date?: string;
  class?: string | number;
  section?: string;
  roll?: string | number;
  school_name?: string;
};

/**
 * Fills SMS placeholders exactly like the server's `interpolate()` in
 * server/src/modules/attendence/attendence.service.ts, so estimates measure the text that is sent.
 */
export const fillSmsTemplate = (template: string, v: SmsTemplateValues) =>
  template
    .replace(/{student_name}/g, v.student_name ?? '')
    .replace(/{login_id}/g, String(v.login_id ?? ''))
    .replace(/{date}/g, v.date ?? '')
    .replace(/{class}/g, String(v.class ?? ''))
    .replace(/{section}/g, v.section ?? '')
    .replace(/{roll}/g, String(v.roll ?? ''))
    .replace(/{school_name}/g, v.school_name ?? '');

/** SMS credits (segments) one filled-in message costs. */
export const smsCredits = (template: string, v: SmsTemplateValues) =>
  calculateSMSCount(fillSmsTemplate(template, v)).count;

/** "2026-10-04" → "04/10/2026", the {date} format the server sends. */
export const smsDate = (isoDate: string) => isoDate.split('-').reverse().join('/');
