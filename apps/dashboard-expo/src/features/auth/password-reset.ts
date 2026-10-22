/**
 * Forgot-password flow for teachers (by email) and students (by login ID), mirroring the web
 * login page's three calls: request a code, check the code, set the new password.
 * Everything here is pure so the rules and texts are unit-tested.
 */
import { ApiError, type ResetRole, type ResetStep } from '@/lib/api';

export const RESET_IDENTIFIER: Record<
  ResetRole,
  { key: 'email' | 'login_id'; label: string; placeholder: string; hint: string }
> = {
  teacher: {
    key: 'email',
    label: 'Email',
    placeholder: 'you@example.com',
    hint: 'Enter the email address your school has on file.',
  },
  student: {
    key: 'login_id',
    label: 'Login ID',
    placeholder: '6-digit login ID',
    hint: 'Enter your 6-digit login ID.',
  },
};

export const MIN_NEW_PASSWORD = 8;
export const CODE_LENGTH = 6;
/** Seconds before "Resend code" works again (the server also rate-limits requests). */
export const RESEND_SECONDS = 60;

export type FlowStep = 'request' | 'code' | 'password' | 'done';
export const FLOW_STEPS: readonly FlowStep[] = ['request', 'code', 'password'];
/** 1-3 for the progress indicator; the success screen counts as the last step. */
export const stepNumber = (s: FlowStep) => (s === 'done' ? 3 : FLOW_STEPS.indexOf(s) + 1);

export interface ResetForm {
  identifier: string;
  code: string;
  newPassword: string;
  confirm: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Sanitised identifier for a role, or the message to show. */
export function checkIdentifier(
  role: ResetRole,
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const v = raw.trim();
  if (!v) return { ok: false, error: `${RESET_IDENTIFIER[role].label} is required.` };
  if (role === 'teacher') {
    return EMAIL.test(v)
      ? { ok: true, value: v.toLowerCase() }
      : { ok: false, error: 'Enter a valid email address.' };
  }
  return /^\d{6}$/.test(v)
    ? { ok: true, value: v }
    : { ok: false, error: 'Login ID must be exactly 6 digits.' };
}

/** Request body for a step, or the message to show. */
export function buildResetBody(
  role: ResetRole,
  step: ResetStep,
  f: ResetForm,
): { ok: true; body: Record<string, string> } | { ok: false; error: string } {
  const id = checkIdentifier(role, f.identifier);
  if (!id.ok) return id;
  const body: Record<string, string> = { [RESET_IDENTIFIER[role].key]: id.value };
  if (step === 'request') return { ok: true, body };
  if (!isCodeComplete(f.code)) return { ok: false, error: 'Enter all 6 digits.' };
  body.code = f.code;
  if (step === 'check-code') return { ok: true, body };
  const pw = passwordProblem(f.newPassword, f.confirm);
  if (pw) return { ok: false, error: pw };
  body.newPassword = f.newPassword;
  return { ok: true, body };
}

/** Keep only digits, at most CODE_LENGTH (typing, pasting, autofill). */
export const cleanCode = (raw: string) => raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
export const isCodeComplete = (code: string) => code.length === CODE_LENGTH && /^\d+$/.test(code);

/** What stops the password from being saved, or null. Matches the server: 8+ characters. */
export function passwordProblem(newPassword: string, confirm: string): string | null {
  if (newPassword.length < MIN_NEW_PASSWORD) {
    return `Use at least ${MIN_NEW_PASSWORD} characters.`;
  }
  if (newPassword !== confirm) return 'The two passwords do not match.';
  return null;
}

/** "ab•••@school.edu" so the screen can say where the code went without printing it all. */
export function maskIdentifier(role: ResetRole, value: string): string {
  const v = value.trim();
  if (role === 'student') return `Login ID ${v}`;
  const at = v.indexOf('@');
  if (at < 1) return v;
  const name = v.slice(0, at);
  return `${name.slice(0, Math.min(2, name.length))}•••${v.slice(at)}`;
}

/** Whole seconds left until `until` (ms timestamp), never negative. */
export const secondsLeft = (until: number, now: number) =>
  Math.max(0, Math.ceil((until - now) / 1000));

/** "Resend code" / "Resend code in 42s". */
export const resendLabel = (left: number) => (left > 0 ? `Resend code in ${left}s` : 'Resend code');

/**
 * User-facing text for a failed call. The server's own message is kept (it knows whether the
 * code was wrong or expired); transport and rate-limit failures get fixed, clearer texts.
 */
export function resetErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isTransport) return "Can't reach the server. Check your connection and try again.";
    if (error.status === 429) return 'Too many attempts. Wait a few minutes and try again.';
    if (error.message) return error.message;
  }
  return 'Something went wrong. Please try again.';
}

/** A rejection that means the code itself is no longer usable (wrong, expired or used). */
export function isCodeRejected(error: unknown): boolean {
  return error instanceof ApiError && [400, 401, 403, 404, 410].includes(error.status ?? 0);
}

/** Strength of a new password for the meter (length first, then variety), 0-4. */
export function passwordScore(pw: string): number {
  if (pw.length === 0) return 0;
  let score = pw.length >= MIN_NEW_PASSWORD ? 1 : 0;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}
export const SCORE_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong'] as const;
