/**
 * Column-header sorting, as in the web dashboard's ColumnHeaderMenu: clicking a header cycles
 * unsorted → ascending → descending → unsorted; clicking another column starts it ascending.
 * Server-sorted lists send `{ sort, order }`; client lists use `sortRows`.
 */
export type SortOrder = 'asc' | 'desc';

export interface TableSort<K extends string = string> {
  key: K;
  order: SortOrder;
}

export function nextSort<K extends string>(
  current: TableSort<K> | null | undefined,
  key: K,
): TableSort<K> | null {
  if (!current || current.key !== key) return { key, order: 'asc' };
  return current.order === 'asc' ? { key, order: 'desc' } : null;
}

/** `"date:desc"` (the Sort select values) ⇄ `{ key, order }`. Bad input gives null. */
export function parseSortValue<K extends string>(
  value: string,
  keys: readonly K[],
): TableSort<K> | null {
  const [key, order] = value.split(':');
  if (!key || !keys.includes(key as K)) return null;
  return { key: key as K, order: order === 'desc' ? 'desc' : 'asc' };
}

export const sortValue = (s: TableSort | null): string => (s ? `${s.key}:${s.order}` : '');

type SortValue = string | number | null | undefined;

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Stable sort by one accessor; empty values (null, undefined, '') always go last. */
export function sortRows<T, K extends string>(
  rows: readonly T[],
  sort: TableSort<K> | null | undefined,
  accessors: Partial<Record<K, (row: T) => SortValue>>,
): T[] {
  const get = sort ? accessors[sort.key] : undefined;
  if (!sort || !get) return [...rows];
  const dir = sort.order === 'asc' ? 1 : -1;
  return rows
    .map((row, i) => ({ row, i, v: get(row) }))
    .sort((a, b) => {
      const ae = a.v === null || a.v === undefined || a.v === '';
      const be = b.v === null || b.v === undefined || b.v === '';
      if (ae || be) return ae && be ? a.i - b.i : ae ? 1 : -1;
      const c =
        typeof a.v === 'number' && typeof b.v === 'number'
          ? a.v - b.v
          : collator.compare(String(a.v), String(b.v));
      return c === 0 ? a.i - b.i : c * dir;
    })
    .map((x) => x.row);
}

/**
 * Sort select options plus the current header-picked sort when the list doesn't have it
 * (e.g. "Name, descending"), so the select always shows what the table is sorted by.
 */
export function withSortOption(
  options: readonly { value: string; label: string }[],
  value: string,
  labels: Record<string, string>,
): { value: string; label: string }[] {
  if (!value || options.some((o) => o.value === value)) return [...options];
  const [key, order] = value.split(':');
  const label = labels[key ?? ''];
  if (!label) return [...options];
  return [
    ...options,
    { value, label: `${label}, ${order === 'desc' ? 'descending' : 'ascending'}` },
  ];
}

/**
 * Select value for a header click on a list that always has some sort (`fallback`, e.g.
 * "date:desc"): clearing goes back to the fallback, except when that is already the current sort,
 * which would make the header look dead, so it flips to ascending instead.
 */
export function headerSortValue(next: TableSort | null, current: string, fallback: string): string {
  if (next) return sortValue(next);
  if (!fallback || fallback !== current) return fallback;
  const [key] = fallback.split(':');
  return `${key}:asc`;
}
