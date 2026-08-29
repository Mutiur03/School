import { z } from 'zod';
import { PHONE_NUMBER, ROLL_NUMBER, SECTION } from './regex.js';

/** Public "check registration status" lookup: year + section + roll + phone. */
export const registrationLookupSchema = z
  .object({
    year: z.union([z.string(), z.number()]),
    section: z.union([z.string(), z.number()]),
    roll: z.union([z.string(), z.number()]),
    phone: z.string(),
  })
  .transform((data) => ({
    year: String(data.year ?? '').trim(),
    section: String(data.section ?? '')
      .trim()
      .toUpperCase(),
    roll: String(data.roll ?? '').trim(),
    phone: String(data.phone ?? '').trim(),
  }))
  .pipe(
    z.object({
      year: z
        .string()
        .min(1, 'Year is required')
        .regex(/^\d{4}$/, 'Year must be a 4-digit year'),
      section: z
        .string()
        .min(1, 'Section is required')
        .regex(SECTION, 'Section must be a single letter (A-Z)'),
      roll: z
        .string()
        .min(1, 'Roll is required')
        .regex(ROLL_NUMBER, 'Roll must be a number between 1 and 999999'),
      phone: z
        .string()
        .min(1, 'Mobile number is required')
        .regex(PHONE_NUMBER, 'Mobile must be 11 digits and start with 01'),
    }),
  );

export type RegistrationLookupInput = z.input<typeof registrationLookupSchema>;
export type RegistrationLookupData = z.infer<typeof registrationLookupSchema>;
