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
const LOADING_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title></title><style>
*{box-sizing:border-box}html,body{height:100%;margin:0}
body{display:flex;align-items:center;justify-content:center;padding:24px;background:#f8fafc;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:center}
.s{width:40px;height:40px;margin:0 auto 16px;border:4px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;animation:r .8s linear infinite}
p{margin:0;max-width:28rem;font-size:clamp(15px,4.5vw,18px);font-weight:600;color:#0f172a}
.h{margin-top:4px;font-size:14px;font-weight:400;color:#64748b}
@keyframes r{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.s{animation-duration:2.4s}}
</style></head><body><main role="status" aria-live="polite"><div class="s" aria-hidden="true"></div><p></p><p class="h">This can take a few seconds. Keep this tab open.</p></main></body></html>`;

/**
 * Opens a tab synchronously (inside the click, so popup blockers allow it) showing a loading
 * page until `openBlobInNewTab(blob, tab)` points it at the PDF. Close it on failure.
 */
export function openPdfLoadingTab(message = 'Generating PDF…'): Window | null {
  const tab = window.open('', '_blank');
  if (!tab) return null;
  tab.document.write(LOADING_PAGE);
  tab.document.close();
  tab.document.title = message;
  tab.document.querySelector('p')!.textContent = message;
  return tab;
}

export function getFilenameFromContentDisposition(
  header: string | undefined | null,
): string | null {
  if (!header) return null;
  const match = /filename\*?=(?:UTF-8''|")?([^";\n]+)/i.exec(header);
  return match?.[1]?.replace(/"/g, '').trim() ?? null;
}
