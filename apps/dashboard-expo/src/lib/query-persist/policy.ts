/**
 * What the on-device query cache may keep. Pure (no React / native imports) so it is unit tested.
 *
 * Only home-screen data is ever written, from an explicit allowlist of non-personal, school-wide
 * queries:
 *   - admin home   (app/(dashboard)/index.tsx): ['dashboard', <userId>, 'overview'], i.e. counts,
 *     announcement and event titles, exam dates. Its attendance chart is NOT kept.
 *   - student home (app/student/index.tsx): ['student', <userId>, 'notices'], the school notice
 *     list. The notices page and notice detail reuse this same query, so they benefit too; the
 *     home's profile, attendance, exams and marks queries are NOT kept.
 *   - teacher home (app/teacher/index.tsx -> TeacherProfileScreen) runs no queries (it renders
 *     from the session), so there is nothing to keep.
 * The full admin notices / events / holidays pages, marks, results, attendance, people records,
 * profiles and anything auth-related never match.
 * A snapshot is scoped to one school + role + user, expires after MAX_AGE_MS and is dropped when
 * the app's cache schema (CACHE_SCHEMA_VERSION) or build changes.
 */
import { TENANT_ROOT } from '@/tenant/query-keys';

export const CACHE_SCHEMA_VERSION = 1;
export const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Keys after ['tenant', <tenantKey>, 'private']. '*' matches any single segment (a user id). */
const ALLOWLIST: readonly (readonly string[])[] = [
  ['dashboard', '*', 'overview'], // admin home
  ['student', '*', 'notices'], // student home
];

export function isPersistableKey(queryKey: readonly unknown[], tenantKey: string): boolean {
  if (queryKey[0] !== TENANT_ROOT || queryKey[1] !== tenantKey || queryKey[2] !== 'private') {
    return false;
  }
  const rest = queryKey.slice(3);
  return ALLOWLIST.some(
    (pattern) =>
      rest.length === pattern.length &&
      pattern.every((part, i) => (part === '*' ? typeof rest[i] === 'number' : rest[i] === part)),
  );
}

export interface CacheScope {
  tenantKey: string;
  role: string;
  userId: number;
}

const safe = (v: string) => encodeURIComponent(v).replace(/[^A-Za-z0-9_-]/g, '_');

/** File-name prefix shared by every snapshot of one school. */
export const tenantFilePrefix = (tenantKey: string) => `qc__${safe(tenantKey)}__`;

export const scopeFileName = (scope: CacheScope) =>
  `${tenantFilePrefix(scope.tenantKey)}${safe(scope.role)}__${scope.userId}.json`;

export const scopeId = (scope: CacheScope) => `${scope.tenantKey}|${scope.role}|${scope.userId}`;

export interface PersistedQuery {
  queryKey: readonly unknown[];
  data: unknown;
  dataUpdatedAt: number;
}

export interface CacheSnapshot {
  buster: string;
  scope: string;
  savedAt: number;
  queries: PersistedQuery[];
}

export interface SnapshotSource {
  queryKey: readonly unknown[];
  status: string;
  data: unknown;
  dataUpdatedAt: number;
}

export function buildSnapshot(
  queries: readonly SnapshotSource[],
  scope: CacheScope,
  buster: string,
  now: number,
): CacheSnapshot {
  return {
    buster,
    scope: scopeId(scope),
    savedAt: now,
    queries: queries
      .filter(
        (q) =>
          q.status === 'success' &&
          q.data !== undefined &&
          now - q.dataUpdatedAt < MAX_AGE_MS &&
          isPersistableKey(q.queryKey, scope.tenantKey),
      )
      .map((q) => ({ queryKey: q.queryKey, data: q.data, dataUpdatedAt: q.dataUpdatedAt })),
  };
}

/** Parse a stored snapshot; anything stale, foreign or not allowlisted is dropped. */
export function parseSnapshot(
  raw: string | null,
  scope: CacheScope,
  buster: string,
  now: number,
): PersistedQuery[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (typeof parsed !== 'object' || parsed === null) return [];
  const snap = parsed as Partial<CacheSnapshot>;
  if (snap.buster !== buster || snap.scope !== scopeId(scope)) return [];
  if (typeof snap.savedAt !== 'number' || now - snap.savedAt > MAX_AGE_MS) return [];
  if (!Array.isArray(snap.queries)) return [];
  return snap.queries.filter(
    (q): q is PersistedQuery =>
      typeof q === 'object' &&
      q !== null &&
      Array.isArray(q.queryKey) &&
      typeof q.dataUpdatedAt === 'number' &&
      now - q.dataUpdatedAt < MAX_AGE_MS &&
      isPersistableKey(q.queryKey, scope.tenantKey),
  );
}
