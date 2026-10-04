import { useState } from 'react';
import axios, { type AxiosError } from 'axios';
import { toast } from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { uploadToR2 } from '@/lib/uploadToR2';
import { getFileUrl } from '@/lib/backend';
import { formatDay } from '@/lib/utils';
import { PdfDocument } from './ClassRoutinePDF';

interface PDFData {
  file: string;
  updated_at: string;
  download_url: string;
}

/** Message from a failed axios call, falling back to `fallback`. */
const apiError = (err: unknown, fallback: string) => {
  const data = (err as AxiosError<{ message?: string; error?: string }>).response?.data;
  return data?.message || data?.error || fallback;
};

const QUERY_KEY = ['citizen-charter'];

function CitizenCharter() {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const { data: charter = null, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    // 404 means none uploaded yet.
    queryFn: () =>
      axios
        .get<PDFData>('/api/citizen-charter')
        .then((res) => res.data)
        .catch(() => null),
  });

  const updated = charter?.updated_at ? formatDay(charter.updated_at.split('T')[0]) : null;

  const upload = async (file: File) => {
    setUploading(true);
    setProgress(0);
    try {
      const key = await uploadToR2('/api/citizen-charter/presigned-url', file, setProgress);
      const res = await axios.post<{ data: PDFData }>('/api/citizen-charter', { key });
      queryClient.setQueryData(QUERY_KEY, res.data.data);
      toast.success('Citizen charter uploaded');
    } catch (err) {
      toast.error(apiError(err, 'Failed to upload PDF. Please try again.'));
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">Citizen charter</h1>
        <p className="text-muted-foreground mt-1 text-sm tabular-nums">
          {isLoading
            ? ' '
            : charter
              ? `PDF shown on the public website${updated ? ` · updated ${updated}` : ''}`
              : 'Not uploaded'}
        </p>
      </header>

      <PdfDocument
        label="citizen charter"
        loading={isLoading}
        uploading={uploading}
        progress={progress}
        file={
          charter
            ? {
                viewUrl: getFileUrl(charter.file),
                downloadUrl: getFileUrl(charter.download_url),
                meta: updated ? `PDF · last updated ${updated}` : 'PDF',
              }
            : null
        }
        onPick={(file) => void upload(file)}
      />
    </div>
  );
}

export default CitizenCharter;
