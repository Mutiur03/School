/** Registration settings form (validated client-side; the server re-validates with the shared
 * class6/8/9/JSE RegistrationSettingsSchema, which regSettingsBody's output matches). */
import { z } from 'zod';
import type { RegSettings, RegSettingsInput } from '@/lib/api';

const rollRange = z
  .string()
  .trim()
  .refine((v) => v === '' || /^\d+\s*-\s*\d+$/.test(v), 'Use a range like 01-50');

export const regSettingsFormSchema = z.object({
  year: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'Enter a 4-digit year'),
  reg_open: z.boolean(),
  a_sec_roll: rollRange,
  b_sec_roll: rollRange,
  instruction_for_a: z.string(),
  instruction_for_b: z.string(),
  attachment_instruction: z.string(),
  classmates: z.string(),
  classmates_source: z.enum(['default', 'custom']),
}) satisfies z.ZodType<RegSettingsInput>;

export const regFormValues = (s: RegSettings | undefined, year: string): RegSettingsInput => ({
  year: s ? String(s.year) : year,
  reg_open: s?.reg_open ?? false,
  a_sec_roll: s?.a_sec_roll ?? '',
  b_sec_roll: s?.b_sec_roll ?? '',
  instruction_for_a: s?.instruction_for_a ?? '',
  instruction_for_b: s?.instruction_for_b ?? '',
  attachment_instruction: s?.attachment_instruction ?? '',
  classmates: s?.classmates_source === 'custom' ? s.classmates : '',
  classmates_source: s?.classmates_source ?? 'default',
});
