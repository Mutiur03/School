/**
 * Inline PDF preview. Native has no embedded PDF viewer without a new native module, so it
 * renders nothing there; "View" opens the device's viewer instead. See PdfPreview.web.tsx.
 */
export function PdfPreview(_props: { url: string; title: string; testID?: string }) {
  return null;
}
