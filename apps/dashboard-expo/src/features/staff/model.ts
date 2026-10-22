/** Pure helpers for the Staff List (dashboard/src/pages/Admin/StaffList.tsx). */
import type { StaffInput, StaffRow } from '@/lib/api';

export interface StaffFormValues {
  name: string;
  email: string;
  phone: string;
  designation: string;
  address: string;
}

export const staffDefaults = (s?: StaffRow | null): StaffFormValues => ({
  name: s?.name ?? '',
  email: s?.email ?? '',
  phone: s?.phone ?? '',
  designation: s?.designation ?? '',
  address: s?.address ?? '',
});

/** Total / Designations / With photo strip. */
export function staffStats(rows: readonly StaffRow[]) {
  const designations = new Set(rows.map((r) => r.designation).filter(Boolean));
  return {
    total: rows.length,
    designations: designations.size,
    withPhoto: rows.filter((r) => r.image).length,
  };
}

export function staffDesignations(rows: readonly StaffRow[]): string[] {
  return [...new Set(rows.map((r) => r.designation ?? '').filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

/** Filter value for staff with no designation. */
export const NO_DESIGNATION = 'Not set';

export function filterStaff(
  rows: readonly StaffRow[],
  f: { search: string; designation?: string; designations?: readonly string[] },
): StaffRow[] {
  const q = f.search.trim().toLowerCase();
  const wanted = [...(f.designations ?? []), ...(f.designation ? [f.designation] : [])];
  return rows
    .filter((r) => {
      if (wanted.length && !wanted.includes(r.designation ?? NO_DESIGNATION)) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.phone.includes(q) ||
        (r.email ?? '').toLowerCase().includes(q) ||
        (r.address ?? '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Map zod issues (path[0]) to the first message per field. */
export function issuesToErrors(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): Partial<Record<keyof StaffFormValues, string>> {
  const out: Partial<Record<keyof StaffFormValues, string>> = {};
  for (const i of issues) {
    const k = i.path[0];
    if (typeof k === 'string' && !(k in out)) out[k as keyof StaffFormValues] = i.message;
  }
  return out;
}

/** The parsed schema output, typed for the API (optional fields null when blank). */
export const toStaffInput = (d: {
  name: string;
  email: string | null;
  phone: string;
  designation: string | null;
  address: string | null;
}): StaffInput => ({
  name: d.name,
  email: d.email,
  phone: d.phone,
  designation: d.designation,
  address: d.address,
});

export const isImageFile = (type: string) => type.startsWith('image/');
