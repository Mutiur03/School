import { useSyncExternalStore } from 'react';
import { uploadProgress } from '@/lib/api/uploads';

/** Percent of the file upload in flight (0-100), or null when none is running. */
export function useUploadPercent(): number | null {
  return useSyncExternalStore(uploadProgress.subscribe, uploadProgress.get, uploadProgress.get);
}

/** "Uploading 42%…" while a percent is known, else `idle`. */
export const uploadLabel = (percent: number | null, idle = 'Uploading…') =>
  percent === null ? idle : `Uploading ${percent}%…`;
