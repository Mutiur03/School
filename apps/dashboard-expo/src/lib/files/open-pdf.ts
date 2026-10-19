/**
 * Web build: open a PDF the API returns (marksheets, summaries) in a new tab. The tab is opened
 * synchronously (before the request) so pop-up blockers allow it, like the web dashboard's
 * openPdfLoadingTab(); if the browser blocks it anyway the file is downloaded instead.
 * Native: open-pdf.native.ts caches the PDF and opens it in the device's PDF viewer.
 */
import { checkPdfBytes } from '@/features/student/marksheet-file';
import { ApiError } from '@/lib/api/errors';
import { saveFile } from './save-file';

export type OpenPdfResult = 'opened' | 'unavailable';

export async function openPdf(
  load: () => Promise<ArrayBuffer>,
  fileName: string,
): Promise<OpenPdfResult> {
  if (typeof window === 'undefined') return 'unavailable';
  const tab = window.open('', '_blank');
  try {
    const bytes = await load();
    const check = checkPdfBytes(new Uint8Array(bytes));
    if (!check.ok) throw new ApiError({ kind: 'parse', message: check.message, path: fileName });
    if (!tab) {
      await saveFile(bytes, fileName, 'application/pdf');
      return 'opened';
    }
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    tab.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return 'opened';
  } catch (e) {
    tab?.close();
    throw e;
  }
}

/** Explicit Share on web: download the file. */
export async function sharePdf(
  load: () => Promise<ArrayBuffer>,
  fileName: string,
): Promise<OpenPdfResult> {
  const bytes = await load();
  const check = checkPdfBytes(new Uint8Array(bytes));
  if (!check.ok) throw new ApiError({ kind: 'parse', message: check.message, path: fileName });
  return (await saveFile(bytes, fileName, 'application/pdf')) === 'saved'
    ? 'opened'
    : 'unavailable';
}

/** Native only (views a cached file); web never calls it. */
export async function viewPdfFile(_uri: string, _title: string): Promise<OpenPdfResult> {
  return 'unavailable';
}

/** Web: the public URL as bytes (used by viewStoredPdf on native only). */
export async function fetchPdfBytes(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok)
    throw new ApiError({
      kind: 'http',
      status: res.status,
      message: `Download failed (${res.status}).`,
    });
  return res.arrayBuffer();
}

/** Open the http(s) URL `load` resolves to (e.g. a cached bundle PDF), tab first. */
export async function openRemote(
  load: () => Promise<string>,
  _fileName?: string,
): Promise<OpenPdfResult> {
  if (typeof window === 'undefined') return 'unavailable';
  const tab = window.open('', '_blank');
  try {
    const url = await load();
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else window.open(url, '_blank', 'noopener');
    return 'opened';
  } catch (e) {
    tab?.close();
    throw e;
  }
}
