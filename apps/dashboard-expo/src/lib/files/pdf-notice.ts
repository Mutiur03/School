/**
 * One place for the PDF helpers to tell the user something without each call site wiring a
 * toast (e.g. "No PDF viewer found, choose an app to open it"). ToastProvider registers the sink.
 */
type Sink = (message: string) => void;
let sink: Sink | null = null;

export function setPdfNoticeSink(next: Sink | null): void {
  sink = next;
}

export function pdfNotice(message: string): void {
  sink?.(message);
}

export const NO_VIEWER_NOTICE = 'No PDF viewer found. Choose an app to open it.';
