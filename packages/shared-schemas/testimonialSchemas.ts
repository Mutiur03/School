import { z } from 'zod';
import { BANGLA_ONLY, NAME, PHONE_NUMBER, REGISTRATION_NO } from './regex.js';
import { isValidDateOfBirth } from './utils.js';

/** "board" = JSC/SSC pass testimonial, "class" = Class 6/7/8 annual-exam pass testimonial. */
export const TESTIMONIAL_KINDS = ['board', 'class'] as const;
export const TESTIMONIAL_BOARD_EXAMS = ['SSC', 'JSC'] as const;
export const TESTIMONIAL_CLASSES = ['6', '7', '8'] as const;
export const TESTIMONIAL_GENDERS = ['Male', 'Female'] as const;
/** JSC was used for Class 8 from 2010 through 2020. */
export const TESTIMONIAL_JSC_START_YEAR = 2010;
export const TESTIMONIAL_LAST_JSC_YEAR = 2020;
export const TESTIMONIAL_FIRST_YEAR = 1980;

export type TestimonialKind = (typeof TESTIMONIAL_KINDS)[number];

/** Exams/classes a student can pick for a kind + passing year. */
export function testimonialExamOptions(kind: TestimonialKind, year: number): string[] {
  const jscEra = year >= TESTIMONIAL_JSC_START_YEAR && year <= TESTIMONIAL_LAST_JSC_YEAR;
  if (kind === 'board') return jscEra ? ['SSC', 'JSC'] : ['SSC'];
  return jscEra ? ['6', '7'] : ['6', '7', '8'];
}

export function testimonialRequiresRollRegistration(exam: string, year: number) {
  return exam === 'SSC' || exam === 'JSC' || (exam === '8' && year > TESTIMONIAL_LAST_JSC_YEAR);
}

const banglaName = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(150)
    .regex(BANGLA_ONLY, `${label} must be in Bangla`);
const englishName = (label: string) =>
  z.string().trim().min(1, `${label} is required`).regex(NAME, `${label} must be in English`);

export const testimonialSchema = z
  .object({
    kind: z.enum(TESTIMONIAL_KINDS, 'Select certificate type'),
    exam: z.string().trim().min(1, 'Select exam / class'),
    passing_year: z.coerce
      .number('Passing year is required')
      .int()
      .min(TESTIMONIAL_FIRST_YEAR, 'Invalid passing year')
      .max(new Date().getFullYear(), 'Passing year cannot be in the future'),
    student_name_bn: banglaName("Student's name (Bangla)"),
    student_name_en: englishName("Student's name (English)"),
    father_name_bn: banglaName("Father's name (Bangla)"),
    father_name_en: englishName("Father's name (English)"),
    mother_name_bn: banglaName("Mother's name (Bangla)"),
    mother_name_en: englishName("Mother's name (English)"),
    mobile: z
      .string()
      .trim()
      .regex(PHONE_NUMBER, 'Mobile number must be 11 digits and start with 01'),
    /** Only needed for co-ed schools; boys'/girls' schools derive it server-side. */
    gender: z.enum(TESTIMONIAL_GENDERS, 'Select gender').optional(),
    dob: z.string().trim().refine(isValidDateOfBirth, 'Enter a valid date of birth'),
    roll: z.string().trim().optional(),
    registration_no: z.string().trim().optional(),
    gpa: z.string().trim().optional(),
  })
  // The exam picked decides the kind; never trust a stale/mismatched `kind` from the client.
  .transform((d) => ({
    ...d,
    kind: (d.exam === 'SSC' || d.exam === 'JSC' ? 'board' : 'class') as TestimonialKind,
  }))
  .superRefine((d, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    if (!testimonialExamOptions(d.kind, d.passing_year).includes(d.exam)) {
      issue('exam', `Not available for passing year ${d.passing_year}`);
    }
    if (testimonialRequiresRollRegistration(d.exam, d.passing_year)) {
      if (!d.roll || !/^\d{6}$/.test(d.roll)) issue('roll', 'Roll number must be 6 digits');
      if (!d.registration_no || !REGISTRATION_NO.test(d.registration_no)) {
        issue('registration_no', 'Registration number must be 10 digits');
      }
    }
    if (d.kind !== 'board') return;
    const gpa = Number(d.gpa);
    if (!d.gpa || !/^\d(\.\d{1,2})?$/.test(d.gpa) || gpa < 1 || gpa > 5)
      issue('gpa', 'GPA must be 1.00 – 5.00');
  });

export type TestimonialInput = z.input<typeof testimonialSchema>;
export type TestimonialData = z.output<typeof testimonialSchema>;
