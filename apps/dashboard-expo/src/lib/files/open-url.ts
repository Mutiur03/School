import { Linking, Platform } from 'react-native';
import { fetchPdfBytes, openPdf } from './open-pdf';
import { isPdfUrl, pdfNameFromUrl } from './pdf-name';

function openInBrowser(url: string): true {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    void Linking.openURL(url);
  }
  return true;
}

/**
 * Open a public http(s) file URL (CDN / presigned). Web: a new tab. Native: a PDF is downloaded
 * and shown in the device's PDF viewer through the central helper (falls back to the browser if
 * the download fails); anything else (photos, links) opens the URL.
 */
export async function openFileUrl(url: string, fileName?: string): Promise<boolean> {
  if (Platform.OS !== 'web' && (fileName || isPdfUrl(url))) {
    try {
      const r = await openPdf(() => fetchPdfBytes(url), fileName ?? pdfNameFromUrl(url));
      if (r === 'opened') return true;
    } catch {
      // Fall through to the browser.
    }
  }
  return openInBrowser(url);
}
