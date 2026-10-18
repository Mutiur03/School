/**
 * Web: the refresh token is an HttpOnly cookie the browser manages, so JavaScript persists
 * nothing. Keeping credentials out of localStorage is deliberate (XSS cannot read the cookie).
 */
import { createMemorySessionPersistence, type SessionPersistence } from '@/lib/api';

export function createSessionPersistence(_tenantKey: string): SessionPersistence {
  return { ...createMemorySessionPersistence(), kind: 'none' };
}
