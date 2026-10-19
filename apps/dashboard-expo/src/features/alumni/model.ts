/** Pure helpers for the Alumni List (dashboard/src/pages/Admin/AlumniList.tsx). */
import type { AlumnusRow } from '@/lib/api';

export type AlumniSort = 'name' | 'batch' | 'district';

export interface AlumniFilters {
  search: string;
  /** Ticked batches / districts; empty means all (the web's column-menu checkboxes). */
  batch: readonly string[];
  district: readonly string[];
  sort: AlumniSort;
  /** Defaults to newest batch first / A–Z for the other columns. */
  order?: 'asc' | 'desc';
}

/** Natural direction of each sort (the select picks these; headers can flip them). */
export const alumniDefaultOrder = (sort: AlumniSort): 'asc' | 'desc' =>
  sort === 'batch' ? 'desc' : 'asc';

export const alumniPhone = (a: Pick<AlumnusRow, 'father_phone' | 'mother_phone'>) =>
  a.father_phone || a.mother_phone || null;

export const alumniAddress = (
  a: Pick<AlumnusRow, 'village' | 'post_office' | 'upazila' | 'district'>,
) => [a.village, a.post_office, a.upazila, a.district].filter(Boolean).join(', ');

/** Distinct batches (newest first) and districts (A–Z) for the filters. */
export function alumniFacets(rows: readonly AlumnusRow[]) {
  const batches = [...new Set(rows.map((r) => r.batch).filter(Boolean))].sort((a, b) =>
    b.localeCompare(a, undefined, { numeric: true }),
  );
  const districts = [...new Set(rows.map((r) => r.district ?? '').filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
  return { batches, districts };
}

export function filterAlumni(rows: readonly AlumnusRow[], f: AlumniFilters): AlumnusRow[] {
  const q = f.search.trim().toLowerCase();
  const out = rows.filter((r) => {
    if (f.batch.length && !f.batch.includes(r.batch)) return false;
    if (f.district.length && !f.district.includes(r.district ?? '')) return false;
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      (r.father_phone ?? '').includes(q) ||
      (r.mother_phone ?? '').includes(q)
    );
  });
  const dir = (f.order ?? alumniDefaultOrder(f.sort)) === 'asc' ? 1 : -1;
  const by = (a: AlumnusRow, b: AlumnusRow) => {
    if (f.sort === 'batch') {
      const c = a.batch.localeCompare(b.batch, undefined, { numeric: true });
      if (c) return c * dir;
    } else if (f.sort === 'district') {
      const c = (a.district ?? '').localeCompare(b.district ?? '');
      if (c) return c * dir;
    } else {
      return a.name.localeCompare(b.name) * dir;
    }
    return a.name.localeCompare(b.name);
  };
  return out.sort(by);
}

/** "120 alumni · 6 batches", or "12 of 120 alumni" when filtered. */
export function alumniSummary(total: number, shown: number, batches: number, filtered: boolean) {
  if (filtered) return `${shown.toLocaleString()} of ${total.toLocaleString()} alumni`;
  return `${total.toLocaleString()} alumni · ${batches.toLocaleString()} batch${batches === 1 ? '' : 'es'}`;
}
