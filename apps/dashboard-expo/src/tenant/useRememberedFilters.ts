import { useEffect, useRef } from 'react';
import { useTenantStorage } from './useTenantStorage';

/**
 * Remembers a screen's dropdown picks on this device (per school, cleared on school switch).
 * `restore` gets the saved values once, on open; nothing is saved until that read finished,
 * so the defaults never overwrite what was stored. Unknown/invalid fields are the caller's to skip.
 */
export function useRememberedFilters<T extends object>(
  name: string,
  values: T,
  restore: (saved: Partial<T>) => void,
) {
  const storage = useTenantStorage();
  const loaded = useRef(false);

  useEffect(() => {
    let alive = true;
    loaded.current = false;
    void storage
      .get(name)
      .then((raw) => {
        if (!alive || !raw) return;
        const saved: unknown = JSON.parse(raw);
        if (saved && typeof saved === 'object') restore(saved as Partial<T>);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) loaded.current = true;
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once per screen/school
  }, [storage, name]);

  const json = JSON.stringify(values);
  useEffect(() => {
    if (loaded.current) void storage.set(name, json).catch(() => {});
  }, [storage, name, json]);
}

/** Field guards for restored values (storage is untrusted: old versions, other schools' shapes). */
export const asNumber = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;
export const asString = (v: unknown) => (typeof v === 'string' ? v : undefined);
export const asNumbers = (v: unknown) =>
  Array.isArray(v) && v.every((x) => typeof x === 'number') ? (v as number[]) : undefined;
export const asStrings = (v: unknown) =>
  Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : undefined;
