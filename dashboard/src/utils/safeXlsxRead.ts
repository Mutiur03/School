import * as XLSX from 'xlsx';

/** ponytail: caps ReDoS/memory from admin uploads; upgrade path = replace xlsx parser. */
const MAX_XLSX_BYTES = 5 * 1024 * 1024;
const MAX_SHEET_ROWS = 10_000;

export function readAdminXlsxWorkbook(arrayBuffer: ArrayBuffer) {
  if (arrayBuffer.byteLength > MAX_XLSX_BYTES) {
    throw new Error('Spreadsheet exceeds the 5MB upload limit');
  }

  const workbook = XLSX.read(arrayBuffer, {
    type: 'array',
    cellDates: true,
    sheetStubs: true,
    dense: true,
  });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Spreadsheet has no worksheets');
  }

  const sheet = workbook.Sheets[sheetName];
  const rowCount = XLSX.utils.sheet_to_json(sheet, { header: 1 }).length;
  if (rowCount > MAX_SHEET_ROWS) {
    throw new Error(`Spreadsheet exceeds ${MAX_SHEET_ROWS} row limit`);
  }

  return { workbook, sheet, sheetName };
}
