/**
 * Minimal .xlsx reader / writer on fflate (zip) only; no SheetJS. The web dashboard parses
 * uploads with SheetJS 0.18.5 (open advisories; the fixed builds are only on SheetJS's own CDN),
 * and the server has no file-import endpoint, so the app reads the first worksheet itself.
 *
 * Reader: first sheet → rows of cell text, like `sheet_to_json(sheet, { header: 1, raw: false })`
 * for the cases the import templates use: shared / inline strings, numbers (as their plain
 * digits), booleans (TRUE / FALSE), and date-formatted numbers as `YYYY-MM-DD`. Same limits as
 * the web's safeXlsxRead: 5 MB file, 10,000 rows; plus an unzip budget against zip bombs.
 *
 * Writer: one sheet of inline strings (the import templates).
 */
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

export const MAX_XLSX_BYTES = 5 * 1024 * 1024;
export const MAX_SHEET_ROWS = 10_000;
const MAX_UNZIPPED_BYTES = 60 * 1024 * 1024;

export class SpreadsheetError extends Error {}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
export function decodeXml(s: string): string {
  return s
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e: string) => {
      if (e[0] === '#') {
        const code =
          e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/_x([0-9a-f]{4})_/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

const attr = (tag: string, name: string): string | null => {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? decodeXml(m[1]!) : null;
};

/** Text of an `<si>` / `<is>` node: every `<t>` run, skipping phonetic `<rPh>` runs. */
function richText(xml: string): string {
  const body = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  let out = '';
  for (const m of body.matchAll(/<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g)) out += m[1] ?? '';
  return decodeXml(out);
}

const BUILTIN_DATE_FMTS = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51,
  52, 53, 54, 55, 56, 57, 58,
]);

/** A custom number format that shows a date (d / m / y outside quotes, brackets and escapes). */
export function isDateFormat(code: string): boolean {
  const bare = code
    .replace(/"[^"]*"/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\\./g, '')
    .replace(/_.|\*./g, '');
  return /[dmy]/i.test(bare) && !/^[#0.,%\s?E+-]*$/.test(bare);
}

/** Excel serial (1900 system) → `YYYY-MM-DD`. */
export function serialToIso(serial: number): string {
  // Day 60 is Excel's fictitious 1900-02-29; serials after it are one day ahead.
  const days = Math.floor(serial) - (serial > 60 ? 25569 : 25568);
  const d = new Date(days * 86_400_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

/** "AB12" → 27 (zero-based column index). */
export function columnIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, '').toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

const numberText = (v: string) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  // Excel stores 15 significant digits; strip float noise such as 0.30000000000000004.
  return String(Number(n.toPrecision(15)));
};

export function readXlsxRows(bytes: ArrayBuffer | Uint8Array): string[][] {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (data.byteLength > MAX_XLSX_BYTES)
    throw new SpreadsheetError('Spreadsheet exceeds the 5MB upload limit');
  let budget = MAX_UNZIPPED_BYTES;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data, {
      filter: (f) => {
        const wanted =
          f.name === 'xl/workbook.xml' ||
          f.name === 'xl/_rels/workbook.xml.rels' ||
          f.name === 'xl/sharedStrings.xml' ||
          f.name === 'xl/styles.xml' ||
          f.name.startsWith('xl/worksheets/sheet');
        if (!wanted) return false;
        budget -= f.originalSize;
        if (budget < 0) throw new SpreadsheetError('Spreadsheet is too large to open');
        return true;
      },
    });
  } catch (e) {
    if (e instanceof SpreadsheetError) throw e;
    throw new SpreadsheetError(
      'This is not an .xlsx file (save it as Excel Workbook and try again)',
    );
  }
  const text = (name: string) => (files[name] ? strFromU8(files[name]!) : null);

  const workbook = text('xl/workbook.xml');
  if (!workbook)
    throw new SpreadsheetError(
      'This is not an .xlsx file (save it as Excel Workbook and try again)',
    );
  const firstSheet = /<sheet\b[^>]*>/.exec(workbook)?.[0];
  if (!firstSheet) throw new SpreadsheetError('Spreadsheet has no worksheets');
  const rid = attr(firstSheet, 'r:id');
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const rels = text('xl/_rels/workbook.xml.rels');
  if (rid && rels) {
    for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
      if (attr(m[0], 'Id') === rid) {
        const target = attr(m[0], 'Target') ?? '';
        sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
      }
    }
  }
  const sheet = text(sheetPath);
  if (sheet == null) throw new SpreadsheetError('Spreadsheet has no worksheets');

  const shared: string[] = [];
  const sst = text('xl/sharedStrings.xml');
  if (sst)
    for (const m of sst.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g))
      shared.push(richText(m[1] ?? ''));

  // Style index → shows a date?
  const dateStyle: boolean[] = [];
  const styles = text('xl/styles.xml');
  if (styles) {
    const custom = new Map<number, string>();
    for (const m of styles.matchAll(/<numFmt\b[^>]*>/g)) {
      const id = Number(attr(m[0], 'numFmtId'));
      custom.set(id, attr(m[0], 'formatCode') ?? '');
    }
    const xfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)?.[1] ?? '';
    for (const m of xfs.matchAll(/<xf\b[^>]*>/g)) {
      const id = Number(attr(m[0], 'numFmtId') ?? 0);
      dateStyle.push(
        BUILTIN_DATE_FMTS.has(id) || (custom.has(id) && isDateFormat(custom.get(id)!)),
      );
    }
  }

  const rows: string[][] = [];
  let nextRow = 0;
  for (const rm of sheet.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const r = attr(rm[0], 'r');
    const index = r ? Number(r) - 1 : nextRow;
    if (index >= MAX_SHEET_ROWS)
      throw new SpreadsheetError(`Spreadsheet exceeds ${MAX_SHEET_ROWS} row limit`);
    while (rows.length < index) rows.push([]);
    nextRow = index + 1;
    const cells: string[] = [];
    let nextCol = 0;
    for (const cm of (rm[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const head = `<c${cm[1]}>`;
      const ref = attr(head, 'r');
      const col = ref ? columnIndex(ref) : nextCol;
      nextCol = col + 1;
      const t = attr(head, 't') ?? 'n';
      const inner = cm[2] ?? '';
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      let value = '';
      if (t === 's') value = v != null ? (shared[Number(v)] ?? '') : '';
      else if (t === 'inlineStr') value = richText(/<is>([\s\S]*?)<\/is>/.exec(inner)?.[1] ?? '');
      else if (t === 'str' || t === 'e') value = v != null ? decodeXml(v) : '';
      else if (t === 'b') value = v === '1' ? 'TRUE' : v === '0' ? 'FALSE' : '';
      else if (v != null) {
        const s = Number(attr(head, 's') ?? 0);
        const n = Number(v);
        value =
          dateStyle[s] && Number.isFinite(n) && n > 0 ? serialToIso(n) : numberText(decodeXml(v));
      }
      while (cells.length < col) cells.push('');
      cells[col] = value;
    }
    rows.push(cells);
  }
  return rows;
}

/** Header row + data rows → objects keyed by the header text (trimmed); blank rows dropped. */
export function rowsToObjects(rows: string[][], keyOf: (h: string) => string = (h) => h.trim()) {
  const headers = (rows[0] ?? []).map((h) => keyOf(String(h)));
  return rows
    .slice(1)
    .filter((r) => r.some((c) => String(c).trim() !== ''))
    .map((r) => {
      const o: Record<string, string> = {};
      headers.forEach((h, i) => {
        if (h) o[h] = r[i] ?? '';
      });
      return o;
    });
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colName = (i: number) => {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26))
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

/** A one-sheet workbook of text cells (import templates). */
export function buildXlsx(sheetName: string, rows: string[][]): Uint8Array {
  const sheetRows = rows
    .map(
      (r, ri) =>
        `<row r="${ri + 1}">${r
          .map(
            (c, ci) =>
              `<c r="${colName(ci)}${ri + 1}" t="inlineStr"><is><t xml:space="preserve">${esc(c)}</t></is></c>`,
          )
          .join('')}</row>`,
    )
    .join('');
  const x = (s: string) => strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${s}`);
  return zipSync({
    '[Content_Types].xml': x(
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    ),
    '_rels/.rels': x(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ),
    'xl/workbook.xml': x(
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': x(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    ),
    'xl/worksheets/sheet1.xml': x(
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`,
    ),
  });
}
