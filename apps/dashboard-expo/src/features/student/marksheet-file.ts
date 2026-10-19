/** Pure helpers for the native marksheet download (file naming, response checks). */

/** `marksheet-<exam>-<year>.pdf` with only [a-z0-9-] in the exam part (safe on every FS). */
export function marksheetFileName(exam: string, year: number): string {
  const slug =
    exam
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'exam';
  const y = Number.isInteger(year) && year > 0 ? year : 'unknown';
  return `marksheet-${slug}-${y}.pdf`;
}

export type PdfCheck = { ok: true } | { ok: false; message: string };

const FALLBACK = 'The server did not return a marksheet PDF. Try again in a moment.';

/**
 * A 2xx body is only saved when it is really a PDF (`%PDF-` magic). Anything else (an HTML
 * error page, a JSON envelope with success:false) is rejected, using the server's message
 * when there is one.
 */
export function checkPdfBytes(bytes: Uint8Array): PdfCheck {
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return { ok: true };
  }
  if (bytes.length === 0) return { ok: false, message: 'The marksheet file was empty.' };
  try {
    const text = new TextDecoder().decode(bytes.slice(0, 4096));
    const body = JSON.parse(text) as { message?: unknown; error?: unknown };
    const msg = typeof body.message === 'string' ? body.message : body.error;
    if (typeof msg === 'string' && msg.trim()) return { ok: false, message: msg.trim() };
  } catch {
    // not JSON
  }
  return { ok: false, message: FALLBACK };
}
