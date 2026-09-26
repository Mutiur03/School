import { z } from 'zod';
import { SMS_SERVICE_TYPES } from '@/utils/sms-providers/index.js';

/** Blank strings and null mean "not sent" for optional credential fields. */
const omitBlank = (value: unknown) => {
  if (value == null) return undefined;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

/**
 * Writable SMS credential fields only.
 * Display values from the Super Admin editor (`estimated_sms`, `balance_message`,
 * `api_key_masked`) are stripped so they never reach Prisma.
 */
export const updateSmsCredentialsSchema = z
  .object({
    sender_id: z.preprocess(
      (value) => (value === null ? '' : value),
      z
        .string()
        .trim()
        .min(1, 'Sender ID is required')
        .max(50, 'Sender ID cannot exceed 50 characters')
        .optional(),
    ),
    api_key: z
      .union([
        z.null(),
        z.string().trim().min(1, 'API key cannot be empty').max(255, 'API key is too long'),
      ])
      .optional(),
    api_url: z.preprocess(
      omitBlank,
      z.string().max(255, 'API URL cannot exceed 255 characters').optional(),
    ),
    service_type: z.preprocess(
      omitBlank,
      z.enum(SMS_SERVICE_TYPES, { message: 'Unknown SMS provider' }).optional(),
    ),
  })
  .transform(({ sender_id, api_key, api_url, service_type }) => ({
    ...(sender_id !== undefined ? { sender_id } : {}),
    ...(api_key !== undefined ? { api_key } : {}),
    ...(api_url !== undefined ? { api_url } : {}),
    ...(service_type !== undefined ? { service_type } : {}),
  }));

export type SmsCredentialsUpdate = z.infer<typeof updateSmsCredentialsSchema>;
