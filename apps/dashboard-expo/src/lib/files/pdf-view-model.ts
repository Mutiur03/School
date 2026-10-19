/**
 * Pure part of the native PDF viewer (testable without native modules): the ACTION_VIEW intent
 * and how long to wait for Android to reject it before treating the viewer as open.
 */
export const ACTION_VIEW = 'android.intent.action.VIEW';
/** Intent.FLAG_GRANT_READ_URI_PERMISSION */
export const FLAG_GRANT_READ_URI_PERMISSION = 1;
export const PDF_MIME = 'application/pdf';
/** startActivityAsync only settles when the viewer closes; a missing viewer rejects at once. */
export const VIEWER_SETTLE_MS = 1500;

export function viewIntent(contentUri: string) {
  return { data: contentUri, type: PDF_MIME, flags: FLAG_GRANT_READ_URI_PERMISSION };
}

/**
 * 'opened' if `launch` is still running after `settleMs` (the viewer is up) or finished fine;
 * 'no-viewer' if it rejected within the window. A later rejection is swallowed.
 */
export async function launchOrDetect(
  launch: () => Promise<unknown>,
  settleMs = VIEWER_SETTLE_MS,
): Promise<'opened' | 'no-viewer'> {
  const run = launch();
  run.catch(() => {});
  let timer: ReturnType<typeof setTimeout> | undefined;
  const waited = new Promise<'opened'>((r) => {
    timer = setTimeout(() => r('opened'), settleMs);
  });
  try {
    return await Promise.race([run.then(() => 'opened' as const), waited]);
  } catch {
    return 'no-viewer';
  } finally {
    clearTimeout(timer);
  }
}
