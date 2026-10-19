import { fileUrl } from '@/features/student/components';
import { openFileUrl } from '@/lib/files/open-url';

/**
 * Open a stored R2 key (or absolute URL) from the public CDN. Web: a new tab. Native: PDFs open
 * in the device's PDF viewer (central helper); anything else (photos) opens the URL.
 */
export async function openStoredFile(key: string | null | undefined): Promise<boolean> {
  const url = fileUrl(key);
  return url ? openFileUrl(url) : false;
}

/**
 * "View" for a stored PDF under a friendly file name. Native: the device's PDF viewer (no viewer
 * → share sheet + toast; download failure → the browser). Web: a new tab.
 */
export async function viewStoredPdf(
  key: string | null | undefined,
  fileName: string,
): Promise<boolean> {
  const url = fileUrl(key);
  return url ? openFileUrl(url, fileName) : false;
}
