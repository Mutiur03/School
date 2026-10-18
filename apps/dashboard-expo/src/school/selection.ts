/**
 * The school picked with a school code. Public data only (what the lookup returned), stored in
 * the platform key-value store under one global key. Never a school id, never a credential.
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
  roleHint: lookup.roleHint,
  selectedAt: now,
});

const isRoleHint = (v: unknown): v is RoleHint =>
  v === 'admin' || v === 'teacher' || v === 'student';

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

export const loadSelection = async (store: KeyValueStore) =>
  parseSelection(await store.getItem(SELECTION_KEY));
export const saveSelection = (store: KeyValueStore, selection: SchoolSelection) =>
  store.setItem(SELECTION_KEY, JSON.stringify(selection));
export const clearSelection = (store: KeyValueStore) => store.removeItem(SELECTION_KEY);
