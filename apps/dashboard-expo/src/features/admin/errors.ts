/** Toast text for a failed admin mutation, matching the web pages' error handling. */
import { isApiError } from '@/lib/api';

/**
 * Prefer the first validation issue (`errors[0]` with its field name, as subject.queries.ts
 * does), then the server message, then `fallback`.
 */
export function mutationErrorMessage(error: unknown, fallback: string): string {
  if (isApiError(error)) {
    if (error.isTransport) return "Can't reach the server. Check your connection and try again.";
    const first = error.details[0] as { path?: unknown; message?: unknown } | undefined;
    if (first && typeof first.message === 'string' && first.message.trim()) {
      const path = Array.isArray(first.path) ? first.path[first.path.length - 1] : null;
      return typeof path === 'string' && path ? `${path}: ${first.message}` : first.message;
    }
    if (error.message) return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** "1 student" / "3 students". */
export const plural = (n: number, word: string, many = `${word}s`) =>
  `${n.toLocaleString()} ${n === 1 ? word : many}`;
