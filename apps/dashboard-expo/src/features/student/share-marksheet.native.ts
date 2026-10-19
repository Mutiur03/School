/**
 * Native marksheet: fetch the PDF through the API client (Bearer token + tenant headers,
 * 401 → refresh → one retry; the token never goes in the URL), then the central PDF helper
 * checks it and opens it in the device's PDF viewer (`view`) or the share sheet (`share`).
 */
import type { StudentPortalApi } from '@/lib/api';
import { openPdf, sharePdf, type OpenPdfResult } from '@/lib/files/open-pdf';
import { marksheetFileName } from './marksheet-file';

export async function openMarksheet(
  api: StudentPortalApi,
  p: { studentId: number; year: number; exam: string },
  mode: 'view' | 'share' = 'view',
): Promise<OpenPdfResult> {
  const run = mode === 'share' ? sharePdf : openPdf;
  return run(() => api.marksheetBytes(p), marksheetFileName(p.exam, p.year));
}
