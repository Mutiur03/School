import { useRef, useState } from 'react';
import axios, { type AxiosError } from 'axios';
import { toast } from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, ExternalLink, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { ConfirmationPopup, SectionCard } from '@/components';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { uploadToR2 } from '@/lib/uploadToR2';
import { getFileUrl } from '@/lib/backend';
import { formatDay } from '@/lib/utils';

interface PDFData {
  id: number;
  pdf_url: string;
  download_url: string;
  created_at?: string;
}

/** Message from a failed axios call, falling back to `fallback`. */
const apiError = (err: unknown, fallback: string) => {
  const data = (err as AxiosError<{ message?: string; error?: string }>).response?.data;
  return data?.message || data?.error || fallback;
};

/** Single-PDF slot: file card (View / Download / Replace / Remove) or dropzone, plus preview. */
export function PdfDocument({
  label,
  loading,
  file,
  uploading,
  progress,
  onPick,
  onRemove,
}: {
  label: string;
  loading: boolean;
  file: { viewUrl: string; downloadUrl: string; meta: string } | null;
  uploading: boolean;
  progress: number;
  onPick: (file: File) => void;
  onRemove?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (picked: File | undefined) => {
    if (inputRef.current) inputRef.current.value = '';
    if (!picked) return;
    if (picked.type !== 'application/pdf') {
      toast.error('Please select a valid PDF file');
      return;
    }
    onPick(picked);
  };

  return (
    <SectionCard className="mb-6">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {loading ? (
        <Skeleton className="h-16 w-full" />
      ) : uploading ? (
        <div
          className="border-border flex items-center gap-3 rounded-lg border p-3"
          aria-live="polite"
        >
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" aria-hidden="true" />
          <p className="text-sm font-medium tabular-nums">Uploading… {progress}%</p>
        </div>
      ) : file ? (
        <div className="border-border flex flex-wrap items-center gap-3 rounded-lg border p-3 sm:flex-nowrap">
          <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
            <FileText size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">Current {label}</p>
            <p className="text-muted-foreground text-xs">{file.meta}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1">
            <Button type="button" variant="ghost" size="sm" asChild>
              <a href={file.viewUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> View
              </a>
            </Button>
            <Button type="button" variant="ghost" size="sm" asChild>
              <a href={file.downloadUrl} target="_blank" rel="noopener noreferrer" download>
                <Download /> Download
              </a>
            </Button>
            {onRemove && (
              <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
                <Trash2 /> Remove
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
            >
              <Upload /> Replace
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pick(e.dataTransfer.files[0]);
          }}
          className="border-border hover:bg-muted/50 focus-visible:ring-ring flex w-full flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-10 text-center transition-colors focus-visible:outline-none focus-visible:ring-2"
        >
          <Upload size={20} className="text-muted-foreground" />
          <span className="text-sm font-medium">Upload {label} PDF</span>
          <span className="text-muted-foreground text-xs">
            Not uploaded · click or drop a file here
          </span>
        </button>
      )}

      {file && !loading && (
        <div className="border-border mt-4 overflow-hidden rounded-lg border">
          <iframe
            src={file.viewUrl}
            title={`${label} PDF`}
            className="h-[min(70vh,600px)] min-h-[240px] w-full border-0"
          >
            <p>
              Your browser doesn&apos;t support PDFs.{' '}
              <a href={file.viewUrl} target="_blank" rel="noopener noreferrer">
                Download the PDF
              </a>
            </p>
          </iframe>
        </div>
      )}
    </SectionCard>
  );
}

function ClassRoutinePDF() {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const { data: pdf = null, isLoading } = useQuery({
    queryKey: ['class-routine-pdf'],
    queryFn: async () => {
      const res = await axios.get<{ data: PDFData[] }>('/api/class-routine/pdf');
      return res.data.data[0] ?? null;
    },
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['class-routine-pdf'] });

  const upload = async (file: File) => {
    setUploading(true);
    setProgress(0);
    try {
      const key = await uploadToR2('/api/class-routine/presigned-url', file, setProgress);
      if (pdf) await axios.put(`/api/class-routine/pdf/${pdf.id}`, { key });
      else await axios.post('/api/class-routine/pdf', { key });
      await refresh();
      toast.success(pdf ? 'Class routine replaced' : 'Class routine uploaded');
    } catch (err) {
      toast.error(apiError(err, pdf ? 'Failed to update PDF' : 'Failed to upload PDF'));
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const remove = async () => {
    if (!pdf) return;
    try {
      await axios.delete(`/api/class-routine/pdf/${pdf.id}`);
      await refresh();
      toast.success('Class routine removed');
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete PDF'));
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">Class routine</h1>
        <p className="text-muted-foreground mt-1 text-sm tabular-nums">
          {isLoading
            ? ' '
            : pdf
              ? `PDF shown on the public website${pdf.created_at ? ` · added ${formatDay(pdf.created_at.split('T')[0])}` : ''}`
              : 'Not uploaded'}
        </p>
      </header>

      <PdfDocument
        label="class routine"
        loading={isLoading}
        uploading={uploading}
        progress={progress}
        file={
          pdf
            ? {
                viewUrl: getFileUrl(pdf.pdf_url),
                downloadUrl: getFileUrl(pdf.download_url),
                meta: 'PDF · shown on the public website',
              }
            : null
        }
        onPick={(file) => void upload(file)}
        onRemove={() => setConfirmRemove(true)}
      />

      <ConfirmationPopup
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove class routine?"
        msg="Delete this class routine PDF? It disappears from the website until you upload another."
        confirmLabel="Remove PDF"
        onConfirm={() => {
          setConfirmRemove(false);
          void remove();
        }}
      />
    </div>
  );
}

export default ClassRoutinePDF;
