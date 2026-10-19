import {
  ApiError,
  isPlatformLookup,
  normalizeSchoolCode,
  SCHOOL_CODE_PATHS,
  type CodeLookupResult,
  type SchoolCodeLookup,
} from '@/lib/api';

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

export type CodeOutcome = { kind: 'platform' } | { kind: 'school'; lookup: SchoolCodeLookup };

/**
 * What a typed or scanned code leads to. The platform answer opens super-admin sign-in only when
 * this build has a platform URL; otherwise it is the same "not found" as any unknown code. A
 * school answer never carries super_admin (validateLookup drops any role hint but
 * admin/teacher/student).
 */
export function resolveCodeLookup(
  result: CodeLookupResult,
  platformAvailable: boolean,
): CodeOutcome {
  if (!isPlatformLookup(result)) return { kind: 'school', lookup: result };
  if (platformAvailable) return { kind: 'platform' };
  throw new ApiError({
    kind: 'http',
    status: 404,
    message: 'School code not found',
    path: SCHOOL_CODE_PATHS.lookup,
  });
}
