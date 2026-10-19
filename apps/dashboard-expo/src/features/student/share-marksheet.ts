/**
 * Web build: the native path is never used (the screen opens a blob tab instead), so this stub
 * keeps expo-file-system / expo-sharing / expo-intent-launcher out of the web bundle.
 * The native implementation is share-marksheet.native.ts (same signature).
 */
import type { StudentPortalApi } from '@/lib/api';
import type { OpenPdfResult } from '@/lib/files/open-pdf';

export async function openMarksheet(
  _api: StudentPortalApi,
  _p: { studentId: number; year: number; exam: string },
  _mode: 'view' | 'share' = 'view',
): Promise<OpenPdfResult> {
  return 'unavailable';
}
