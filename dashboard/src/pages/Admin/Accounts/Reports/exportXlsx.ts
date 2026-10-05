import * as XLSX from 'xlsx';

/** One-sheet Excel download from plain row objects (keys become headers). */
export const exportXlsx = (rows: Record<string, string | number | null>[], name: string) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name.slice(0, 31));
  XLSX.writeFile(wb, `${name}.xlsx`);
};
