import { z } from 'zod';
import { normalizeOptionalText } from './utils.js';

export const ACC_HEAD_TYPES = ['asset', 'liability', 'equity', 'income', 'expense'] as const;
export type AccHeadType = (typeof ACC_HEAD_TYPES)[number];

export const VOUCHER_TYPES = ['receipt', 'payment', 'contra', 'journal'] as const;
export type VoucherType = (typeof VOUCHER_TYPES)[number];

const optionalText = z.any().optional().transform(normalizeOptionalText);
/** Native <select> gives '' for "none"; map to null, otherwise a numeric id. */
const optionalId = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v) => (v === '' || v == null ? null : Number(v)));

export const accHeadFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  code: optionalText,
  type: z.enum(ACC_HEAD_TYPES),
  parent_id: optionalId,
  is_cash_bank: z.boolean(),
  bank_name: optionalText,
  account_no: optionalText,
  is_active: z.boolean(),
});
export type AccHeadFormInput = z.input<typeof accHeadFormSchema>;
export type AccHeadFormData = z.output<typeof accHeadFormSchema>;

export const costCenterFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  code: optionalText,
  is_active: z.boolean(),
});
export type CostCenterFormInput = z.input<typeof costCenterFormSchema>;
export type CostCenterFormData = z.output<typeof costCenterFormSchema>;

const cents = (n: number | undefined) => Math.round((n ?? 0) * 100);

export const voucherLineSchema = z
  .object({
    head_id: z.number().int().positive('Pick an account head'),
    cost_center_id: z.number().int().positive().nullable().optional(),
    debit: z.number().min(0).optional(),
    credit: z.number().min(0).optional(),
    note: z.string().trim().max(255).nullable().optional(),
  })
  .refine((l) => cents(l.debit) > 0 !== cents(l.credit) > 0, {
    message: 'Each line needs either a debit or a credit amount',
  });

export const voucherFormSchema = z
  .object({
    type: z.enum(VOUCHER_TYPES),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date is required'),
    narration: z.string().trim().max(500).nullable().optional(),
    reference: z.string().trim().max(100).nullable().optional(),
    lines: z.array(voucherLineSchema).min(2, 'A voucher needs at least two lines'),
  })
  .refine(
    (v) =>
      v.lines.reduce((s, l) => s + cents(l.debit), 0) ===
      v.lines.reduce((s, l) => s + cents(l.credit), 0),
    { message: 'Total debit must equal total credit', path: ['lines'] },
  );
export type VoucherFormData = z.infer<typeof voucherFormSchema>;
export type VoucherLineData = z.infer<typeof voucherLineSchema>;
