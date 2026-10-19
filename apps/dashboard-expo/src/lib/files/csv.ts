/**
 * CSV export, used where the web dashboard writes an .xlsx with SheetJS (xlsx 0.18.5, which has
 * open advisories and no maintained npm release). CSV needs no library, opens in Excel / Sheets,
 * and the server is never involved, so it only ever contains what the screen already shows.
 *
 * - RFC 4180 quoting (comma, quote, CR/LF), CRLF line ends, a UTF-8 BOM so Excel reads Bangla.
 * - Formula injection: a text cell starting with = + - @ tab or CR gets a leading apostrophe so
 *   spreadsheet apps show it as text instead of running it (OWASP "CSV injection").
 * - Money: `csvMoney(paisa)` writes the exact two-decimal taka text from integer paisa, marked as
 *   a number so a negative amount is not escaped.
 */
import type { Paisa } from '@/lib/money/money';
import { saveFile, type SaveFileResult } from './save-file';

/** Text written as-is (only numbers built by this module). */
export interface RawCell {
  readonly raw: string;
}
export type CsvCell = string | number | null | undefined | RawCell;

const FORMULA = /^[=+\-@\t\r]/;

export function csvMoney(p: Paisa): RawCell {
  const neg = p < 0;
  const abs = Math.abs(p);
  return {
    raw: `${neg ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`,
  };
}

export function csvCell(v: CsvCell): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return v.raw;
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  const text = FORMULA.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export const CSV_MIME = 'text/csv;charset=utf-8';

/** File-name safe: letters, digits, dot, dash, underscore. */
export const csvFileName = (parts: readonly (string | number | null | undefined)[]) =>
  `${parts
    .filter((p) => p !== null && p !== undefined && p !== '')
    .join('_')
    .replace(/[^\w.-]+/g, '-')}.csv`;

export function csvBytes(text: string): ArrayBuffer {
  const body = new TextEncoder().encode(`\uFEFF${text}`);
  return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
}

export function saveCsv(
  fileName: string,
  headers: readonly string[],
  rows: readonly (readonly CsvCell[])[],
): Promise<SaveFileResult> {
  return saveFile(csvBytes(toCsv(headers, rows)), fileName, CSV_MIME);
}
