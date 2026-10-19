/** Small, total parsers for server JSON. Every API module validates the shape it relies on. */
import { ApiError } from './errors';

export type Json = Record<string, unknown>;

export const isObj = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Numbers and numeric strings; anything else is `fallback`. */
export function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

export function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = num(v, Number.NaN);
  return Number.isNaN(n) ? null : n;
}

/** Non-empty string or null. */
export const strOrNull = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v : typeof v === 'number' ? String(v) : null;

export const str = (v: unknown, fallback = ''): string =>
  typeof v === 'string' ? v : typeof v === 'number' ? String(v) : fallback;

export const bool = (v: unknown, fallback = false): boolean =>
  typeof v === 'boolean' ? v : fallback;

export const parseError = (path: string, what = 'response') =>
  new ApiError({ kind: 'parse', message: `Unexpected ${what} from the server.`, path });

/** Array of objects, or a parse error naming the endpoint. */
export function objArray(v: unknown, path: string): Json[] {
  if (!Array.isArray(v)) throw parseError(path);
  return v.filter(isObj);
}

/** Date-only part of an ISO timestamp or `YYYY-MM-DD` string ('' when missing). */
export const ymd = (v: unknown): string => (typeof v === 'string' ? (v.split('T')[0] ?? '') : '');
