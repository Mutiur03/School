/**
 * Download a Blob as a file. Revoke is deferred so the browser can finish
 * queuing the download (immediate revoke can fail on large/slow files).
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Open a Blob in a new tab (PDF preview). Do not revoke the URL — the viewer
 * tab needs it for Chrome's download / save actions on blob: URLs.
 */
export function openBlobInNewTab(blob: Blob, targetWindow?: Window | null): Window | null {
  const url = URL.createObjectURL(blob);
  if (targetWindow) {
    targetWindow.location.href = url;
    return targetWindow;
  }
  return window.open(url, '_blank');
}

/** Server `message` from a failed `responseType: 'blob'` request (JSON error body), else fallback. */
export async function blobErrorMessage(error: unknown, fallback: string): Promise<string> {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (!(data instanceof Blob)) return fallback;
  try {
    return JSON.parse(await data.text()).message || fallback;
  } catch {
    return fallback;
  }
}

export function getFilenameFromContentDisposition(
  header: string | undefined | null,
): string | null {
  if (!header) return null;
  const match = /filename\*?=(?:UTF-8''|")?([^";\n]+)/i.exec(header);
  return match?.[1]?.replace(/"/g, '').trim() ?? null;
}
