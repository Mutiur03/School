/** Filesystem-safe PDF file name from readable parts: ["Class 9", "Half Yearly", 2026] → class-9-half-yearly-2026.pdf */
export function pdfFileName(parts: readonly (string | number | null | undefined)[]): string {
  const slug = parts
    .filter((p) => p !== null && p !== undefined && String(p).trim() !== '')
    .map((p) =>
      String(p)
        .normalize('NFKD')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    )
    .filter(Boolean)
    .join('-')
    .slice(0, 80);
  return `${slug || 'document'}.pdf`;
}

export const isPdfUrl = (url: string) => /\.pdf(?:$|[?#])/i.test(url);

/** "notice.pdf" from ".../1712345678901-notice.pdf?x=1" (upload timestamp prefix dropped). */
export function pdfNameFromUrl(url: string): string {
  let last = url.split(/[?#]/)[0]!.split('/').pop() ?? '';
  try {
    last = decodeURIComponent(last);
  } catch {
    // keep the raw segment
  }
  return pdfFileName([last.replace(/^\d{10,}[-_]/, '').replace(/\.pdf$/i, '')]);
}
