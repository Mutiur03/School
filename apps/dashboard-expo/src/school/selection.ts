/**
 * The school picked with a school code. Public data only (what the lookup returned), stored in
 * the platform key-value store under one global key. Never a school id, never a credential.
 *
 * The same key can instead hold the platform (super-admin) choice: `{ kind: 'platform' }` plus
 * the platform host. Only one of the two is ever stored, so a reopen goes back to exactly one of
 * them, and Logout / "Use a school code" clear it. A stored platform choice is only honoured
 * while it matches this build's EXPO_PUBLIC_DIRECTORY_URL (never a URL from storage).
 */
import type { RoleHint, SchoolCodeLookup } from '@/lib/api';
import type { KeyValueStore } from '@/lib/storage/key-value';
import { normalizeHost } from '@/tenant/resolve';

export const SELECTION_KEY = 'sd.school-selection';

export interface SchoolSelection {
  host: string;
  apiBaseUrl: string;
  name: string;
  shortName: string | null;
  logo: string | null;
  roleHint: RoleHint | null;
  selectedAt: number;
}

export const selectionFromLookup = (
  lookup: SchoolCodeLookup,
  now = Date.now(),
): SchoolSelection => ({
  host: lookup.tenant.host,
  apiBaseUrl: lookup.tenant.apiBaseUrl,
  name: lookup.school.name,
  shortName: lookup.school.shortName,
  logo: lookup.school.logo,
  // Re-checked here too: a code can only ever pre-select a school role, never super_admin.
  roleHint: isRoleHint(lookup.roleHint) ? lookup.roleHint : null,
  selectedAt: now,
});

function isRoleHint(v: unknown): v is RoleHint {
  return v === 'admin' || v === 'teacher' || v === 'student';
}

export function parseSelection(raw: string | null): SchoolSelection | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<SchoolSelection>;
    const host = normalizeHost(v.host);
    if (!host || host !== v.host || typeof v.name !== 'string') return null;
    if (typeof v.apiBaseUrl !== 'string' || normalizeHost(v.apiBaseUrl) !== host) return null;
    return {
      host,
      apiBaseUrl: v.apiBaseUrl,
      name: v.name,
      shortName: typeof v.shortName === 'string' ? v.shortName : null,
      logo: typeof v.logo === 'string' ? v.logo : null,
      roleHint: isRoleHint(v.roleHint) ? v.roleHint : null,
      selectedAt: typeof v.selectedAt === 'number' ? v.selectedAt : 0,
    };
  } catch {
    return null;
  }
}

/** Platform (super-admin) mode: no school, the build's super-admin origin. */
export interface PlatformSelection {
  kind: 'platform';
  host: string;
  apiBaseUrl: string;
  selectedAt: number;
}

export type StoredSelection =
  { kind: 'school'; school: SchoolSelection } | { kind: 'platform'; platform: PlatformSelection };

/** The platform choice for this build, or null when the build has no super-admin origin. */
export function platformSelectionFor(
  superAdminUrl: string,
  now = Date.now(),
): PlatformSelection | null {
  const host = normalizeHost(superAdminUrl);
  if (!host || !/^https?:\/\/[^/]+$/.test(superAdminUrl)) return null;
  return { kind: 'platform', host, apiBaseUrl: superAdminUrl, selectedAt: now };
}

/**
 * Parse whatever is stored. A platform entry is accepted only when it names this build's
 * super-admin origin; anything else (old build, tampered storage) reads as nothing stored.
 */
export function parseStoredSelection(
  raw: string | null,
  superAdminUrl: string,
): StoredSelection | null {
  if (!raw) return null;
  let kind: unknown;
  try {
    kind = (JSON.parse(raw) as { kind?: unknown }).kind;
  } catch {
    return null;
  }
  if (kind === 'platform') {
    const expected = platformSelectionFor(superAdminUrl);
    if (!expected) return null;
    try {
      const v = JSON.parse(raw) as Partial<PlatformSelection>;
      if (v.host !== expected.host || v.apiBaseUrl !== expected.apiBaseUrl) return null;
      return {
        kind: 'platform',
        platform: { ...expected, selectedAt: typeof v.selectedAt === 'number' ? v.selectedAt : 0 },
      };
    } catch {
      return null;
    }
  }
  const school = parseSelection(raw);
  return school ? { kind: 'school', school } : null;
}

export const loadStoredSelection = async (store: KeyValueStore, superAdminUrl: string) =>
  parseStoredSelection(await store.getItem(SELECTION_KEY), superAdminUrl);
export const loadSelection = async (store: KeyValueStore) =>
  parseSelection(await store.getItem(SELECTION_KEY));
export const saveSelection = (store: KeyValueStore, selection: SchoolSelection) =>
  store.setItem(SELECTION_KEY, JSON.stringify(selection));
export const savePlatformSelection = (store: KeyValueStore, platform: PlatformSelection) =>
  store.setItem(SELECTION_KEY, JSON.stringify(platform));
export const clearSelection = (store: KeyValueStore) => store.removeItem(SELECTION_KEY);
