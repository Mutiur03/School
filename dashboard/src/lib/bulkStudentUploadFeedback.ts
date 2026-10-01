import toast from 'react-hot-toast';
import type { AxiosResponseHeaders, RawAxiosResponseHeaders } from 'axios';

export type BulkStudentUploadResult = {
  blob: Blob;
  created: number;
  requested: number;
};

export const readBulkStudentCounts = (
  headers: RawAxiosResponseHeaders | AxiosResponseHeaders,
): { created: number; requested: number } => {
  const pick = (name: string) => {
    const value = headers[name] ?? headers[name.toLowerCase()];
    return typeof value === 'string' ? Number(value) : Number(value?.[0] ?? NaN);
  };
  const created = pick('x-students-created');
  const requested = pick('x-students-requested');
  return {
    created: Number.isFinite(created) ? created : 0,
    requested: Number.isFinite(requested) ? requested : 0,
  };
};

export const notifyBulkStudentUpload = (created: number, requested: number): void => {
  if (created === 0) {
    toast('No new students inserted — all rows were duplicates (skipped).', {
      icon: '⚠️',
    });
    return;
  }
  if (created < requested) {
    toast.success(
      `Added ${created} of ${requested} students. Credentials downloaded for new rows only.`,
    );
    return;
  }
  toast.success(
    requested === 1
      ? 'Student added successfully. Credentials downloaded.'
      : `Students uploaded successfully (${created}). Credentials downloaded.`,
  );
};
