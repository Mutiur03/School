/**
 * Native PDF helper (every View / Open in the app goes through here):
 *   1. bytes come from the caller (signed-in API client, or a public CDN / presigned URL);
 *   2. they are checked (%PDF) and written to the cache directory;
 *   3. Android: a content:// URI (FileProvider) is opened with ACTION_VIEW, type
 *      application/pdf, FLAG_GRANT_READ_URI_PERMISSION, so the device's PDF viewer shows it.
 *      No viewer installed → the share / open-with sheet, plus a short toast.
 *      iOS: the share sheet, which previews PDFs with QuickLook (expo-web-browser cannot open
 *      local files).
 * `sharePdf` is the explicit Share action (always the share sheet).
 */
import { File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { checkPdfBytes } from '@/features/student/marksheet-file';
import { ApiError } from '@/lib/api/errors';
import { NO_VIEWER_NOTICE, pdfNotice } from './pdf-notice';
import { ACTION_VIEW, PDF_MIME, launchOrDetect, viewIntent } from './pdf-view-model';

export type OpenPdfResult = 'opened' | 'unavailable';

function writePdf(bytes: Uint8Array, fileName: string): string {
  const check = checkPdfBytes(bytes);
  if (!check.ok) throw new ApiError({ kind: 'parse', message: check.message, path: fileName });
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  return file.uri;
}

async function shareSheet(uri: string, title: string): Promise<OpenPdfResult> {
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  await Sharing.shareAsync(uri, { mimeType: PDF_MIME, UTI: 'com.adobe.pdf', dialogTitle: title });
  return 'opened';
}

/** Show a cached PDF in the device's viewer (see the header). */
export async function viewPdfFile(uri: string, title: string): Promise<OpenPdfResult> {
  if (Platform.OS === 'android') {
    const contentUri = await getContentUriAsync(uri);
    const r = await launchOrDetect(() =>
      IntentLauncher.startActivityAsync(ACTION_VIEW, viewIntent(contentUri)),
    );
    if (r === 'opened') return 'opened';
    pdfNotice(NO_VIEWER_NOTICE);
  }
  return shareSheet(uri, title);
}

/** Load, check, cache and view a PDF. */
export async function openPdf(
  load: () => Promise<ArrayBuffer>,
  fileName: string,
): Promise<OpenPdfResult> {
  const uri = writePdf(new Uint8Array(await load()), fileName);
  return viewPdfFile(uri, fileName);
}

/** Explicit Share: load, check, cache, then the share sheet. */
export async function sharePdf(
  load: () => Promise<ArrayBuffer>,
  fileName: string,
): Promise<OpenPdfResult> {
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  const uri = writePdf(new Uint8Array(await load()), fileName);
  return shareSheet(uri, fileName);
}

/** Fetch a public / presigned PDF URL (no app session) as bytes. */
export async function fetchPdfBytes(url: string): Promise<ArrayBuffer> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: 'omit' });
  } catch (cause) {
    throw new ApiError({ kind: 'network', message: "Couldn't download the PDF.", cause });
  }
  if (!res.ok) {
    throw new ApiError({
      kind: 'http',
      status: res.status,
      message: `Download failed (${res.status}).`,
    });
  }
  return res.arrayBuffer();
}

/** A PDF behind an http(s) URL the API hands out (e.g. a cached class bundle): view it. */
export async function openRemote(
  load: () => Promise<string>,
  fileName = 'document.pdf',
): Promise<OpenPdfResult> {
  const url = await load();
  return openPdf(() => fetchPdfBytes(url), fileName);
}
