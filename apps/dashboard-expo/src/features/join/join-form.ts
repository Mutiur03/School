import { ApiError, normalizeSchoolCode } from '@/lib/api';

/** Code ready to submit, or null while it is incomplete / malformed. */
export const submittableCode = (input: string): string | null => normalizeSchoolCode(input);

/**
 * One message per failure class. A missing, revoked and expired code all look the same (the
 * server answers a generic 404) and the app does not try to tell them apart.
 */
export function lookupErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === 'network' || error.kind === 'timeout')
      return "Can't reach the server. Check your connection and try again.";
    if (error.status === 404)
      return "We couldn't find a school with that code. Check it and try again.";
    if (error.status === 429) return 'Too many attempts. Wait a few minutes and try again.';
    if (error.kind === 'parse') return 'The server sent an unexpected response.';
  }
  return 'Something went wrong. Try again.';
}
