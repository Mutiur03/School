import { useState } from 'react';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Eye, EyeOff, ExternalLink, FileUp, Loader2, Pencil, Trash2 } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import DeleteConfirmation from '@/components/DeleteConfimation';
import ActionButton from '@/components/ActionButton';
import { MarksheetGenProgress } from '@/components/MarksheetGenProgress';
import { BundleStalePreview } from '@/components/BundleStalePreview';
import { getFileUrl } from '@/lib/backend';
import { uploadToR2 } from '@/lib/uploadToR2';
import { cn, formatDay } from '@/lib/utils';
import { isMarksheetQueueActive, useMarksheetGenerationStatus } from '@/queries/marks.queries';
import { useDeleteExam, type Exam } from '@/queries/exam.queries';
import { formatExamRange } from './exam-session-rail';

const actionClass = 'w-full justify-center md:w-auto';

export function ExamWorkbenchCard({
  exam,
  onEdit,
  onTogglePublish,
}: {
  exam: Exam;
  onEdit: (exam: Exam) => void;
  onTogglePublish: (exam: Exam) => void;
}) {
  const { data: genStatus } = useMarksheetGenerationStatus(exam.id);
  const deleteExam = useDeleteExam();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const queueActive = isMarksheetQueueActive(genStatus);
  const routineUrl = exam.routine ? getFileUrl(exam.routine) : null;
  const downloadUrl = exam.routine ? getFileUrl(exam.download_url || exam.routine) : null;

  const handleUpload = async (file: File) => {
    setUploading(true);
    setProgress(0);
    try {
      const key = await uploadToR2('/api/exams/presigned-url', file, setProgress);
      await axios.post(`/api/exams/uploadRoutinePDF/${exam.id}`, { key });
      await queryClient.invalidateQueries({ queryKey: ['exams'] });
      toast.success('Routine PDF uploaded');
    } catch (err) {
      const error = err as AxiosError<{ error?: string; message?: string }>;
      toast.error(
        error.response?.data?.message || error.response?.data?.error || 'PDF upload failed',
      );
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleRemovePdf = async () => {
    try {
      await axios.delete(`/api/exams/removeRoutinePDF/${exam.id}`);
      await queryClient.invalidateQueries({ queryKey: ['exams'] });
      toast.success('Routine PDF removed');
    } catch {
      toast.error('Could not remove PDF');
    }
  };

  return (
    <article
      id={`exam-${exam.id}`}
      className={cn(
        'border-border bg-card scroll-mt-24 rounded-xl border',
        exam.is_year_end && 'border-l-primary border-l-4',
      )}
    >
      <div className="flex flex-col gap-3 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-foreground min-w-0 truncate text-sm font-semibold">
              {exam.exam_name}
            </h3>
            {exam.is_year_end ? <Badge variant="default">Year end</Badge> : null}
            <Badge
              variant="outline"
              className={
                exam.visible
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                  : undefined
              }
            >
              {exam.visible ? 'Published' : 'Draft'}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-xs tabular-nums">
            {formatExamRange(exam)}
            <span aria-hidden="true"> · </span>
            Result {formatDay(exam.result_date)}
            {exam.return_date ? (
              <>
                <span aria-hidden="true"> · </span>
                Return {formatDay(exam.return_date)}
              </>
            ) : null}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {exam.levels.map((level) => `Class ${level}`).join(', ')}
          </p>
          {exam.visible && genStatus ? (
            <div className="mt-2 max-w-md">
              <MarksheetGenProgress status={genStatus} compact />
              <BundleStalePreview items={genStatus.bundles.staleItems} variant="inline" />
            </div>
          ) : null}
          {!exam.visible && queueActive ? (
            <p className="text-muted-foreground mt-2 text-xs">Finishing background jobs…</p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-1.5 md:flex md:flex-wrap md:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(actionClass, 'col-span-2 md:col-span-1')}
            onClick={() => onTogglePublish(exam)}
            aria-pressed={exam.visible}
          >
            {exam.visible ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
            {exam.visible ? 'Hide Results' : 'Publish Results'}
          </Button>
          {routineUrl ? (
            <>
              <Button variant="ghost" size="sm" className={actionClass} asChild>
                <a href={routineUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  View PDF
                </a>
              </Button>
              <Button variant="ghost" size="sm" className={actionClass} asChild>
                <a href={downloadUrl ?? routineUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Download
                </a>
              </Button>
              <label
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  actionClass,
                  'cursor-pointer',
                  uploading && 'pointer-events-none opacity-50',
                )}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <FileUp className="h-4 w-4" aria-hidden="true" />
                )}
                {uploading ? `${progress}%` : 'Replace PDF'}
                <input
                  type="file"
                  accept="application/pdf"
                  className="sr-only"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleUpload(file);
                    e.target.value = '';
                  }}
                />
              </label>
              <DeleteConfirmation
                title="Remove routine PDF?"
                confirmLabel="Remove PDF"
                msg="Students will no longer see this routine until you upload another."
                onDelete={() => void handleRemovePdf()}
                trigger={
                  <Button type="button" variant="ghost" size="sm" className={actionClass}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Remove PDF
                  </Button>
                }
              />
            </>
          ) : (
            <label
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                actionClass,
                'cursor-pointer',
                uploading && 'pointer-events-none opacity-50',
              )}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span className="tabular-nums">{progress}%</span>
                </>
              ) : (
                <>
                  <FileUp className="h-4 w-4" aria-hidden="true" />
                  Upload PDF
                </>
              )}
              <input
                type="file"
                accept="application/pdf"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUpload(file);
                  e.target.value = '';
                }}
              />
            </label>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={actionClass}
            onClick={() => onEdit(exam)}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit
          </Button>
          <DeleteConfirmation
            title="Delete this exam?"
            confirmLabel="Delete Exam"
            msg={`Delete “${exam.exam_name}”? Marks and cached marksheets for this exam are removed.`}
            onDelete={() => deleteExam.mutate(exam.id)}
            trigger={<ActionButton action="delete" className={cn(actionClass, 'h-8')} />}
          />
        </div>
      </div>
      {uploading ? (
        <p className="text-muted-foreground sr-only" aria-live="polite">
          Uploading… {progress}%
        </p>
      ) : null}
    </article>
  );
}

export function ExamWorkbenchCardSkeleton() {
  return (
    <article className="border-border bg-card rounded-xl border p-4" aria-busy="true" aria-label="Loading exam">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-5 w-44 max-w-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-56 max-w-full" />
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
          <Skeleton className="h-8 w-full md:w-28" />
          <Skeleton className="h-8 w-full md:w-28" />
          <Skeleton className="h-8 w-full md:w-24" />
        </div>
      </div>
    </article>
  );
}
