/**
 * Web build: hand bytes to the browser as a download (the web dashboard's downloadBlob()).
 * Native: save-file.native.ts writes to the cache directory and opens the share sheet.
 */
export type SaveFileResult = 'saved' | 'unavailable';

export async function saveFile(
  bytes: ArrayBuffer,
  fileName: string,
  mimeType: string,
): Promise<SaveFileResult> {
  if (typeof document === 'undefined') return 'unavailable';
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'saved';
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
