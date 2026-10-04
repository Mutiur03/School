import { useRef, useState } from 'react';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  FileUp,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import { ConfirmationPopup } from '@/components';
import ActionButton from '@/components/ActionButton';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MarksheetGenProgress } from '@/components/MarksheetGenProgress';
import { BundleStalePreview } from '@/components/BundleStalePreview';
import { getFileUrl } from '@/lib/backend';
import { uploadToR2 } from '@/lib/uploadToR2';
import { cn, formatDay } from '@/lib/utils';
import { isMarksheetQueueActive, useMarksheetGenerationStatus } from '@/queries/marks.queries';
import { useDeleteExam, type Exam } from '@/queries/exam.queries';
import { formatExamRange } from './exam-session-rail';

// Pinned Exam column while the table scrolls sideways on narrow screens.
export const stickyCell = 'sticky left-0 z-[1] bg-inherit max-xl:shadow-[1px_0_0_var(--border)]';

export function ExamWorkbenchRow({
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [confirm, setConfirm] = useState<'pdf' | 'exam' | null>(null);

  const queueActive = isMarksheetQueueActive(genStatus);
  const routineUrl = exam.routine ? getFileUrl(exam.routine) : null;
  const downloadUrl = exam.routine ? getFileUrl(exam.download_url || exam.routine) : null;

  const handleUpload = async (file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Routine must be a PDF');
      return;
    }
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

  const pickPdf = () => fileRef.current?.click();

  return (
    // Opaque row colours so the pinned Exam cell hides what scrolls under it.
    <tr
      id={`exam-${exam.id}`}
      className="bg-card scroll-mt-24 align-top transition-colors hover:bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))]"
    >
      <td className={cn(stickyCell, 'px-3 py-2.5 sm:px-4')}>
        <div className="flex max-w-[14rem] flex-wrap items-center gap-1.5 sm:max-w-none">
          <span className="text-sm font-medium">{exam.exam_name}</span>
          {exam.is_year_end ? <Badge variant="default">Year end</Badge> : null}
        </div>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {exam.levels.map((level) => `Class ${level}`).join(', ')}
        </p>
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-sm tabular-nums">
        {formatExamRange(exam)}
        <p className="text-muted-foreground mt-0.5 text-xs">
          Result {formatDay(exam.result_date)}
          {exam.return_date ? <> · Return {formatDay(exam.return_date)}</> : null}
        </p>
      </td>
      <td className="min-w-[13rem] px-4 py-2.5">
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
        {exam.visible && genStatus ? (
          <div className="mt-2 max-w-xs">
            <MarksheetGenProgress status={genStatus} compact />
            <BundleStalePreview items={genStatus.bundles.staleItems} variant="inline" />
          </div>
        ) : null}
        {!exam.visible && queueActive ? (
          <p className="text-muted-foreground mt-1.5 text-xs">Finishing background jobs…</p>
        ) : null}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-sm">
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
            e.target.value = '';
          }}
        />
        {uploading ? (
          <span className="text-muted-foreground inline-flex items-center gap-1.5 tabular-nums">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Uploading {progress}%
          </span>
        ) : routineUrl ? (
          <a
            href={routineUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-visible:ring-ring pointer-coarse:py-2 inline-flex items-center gap-1.5 rounded font-medium hover:underline focus-visible:outline-none focus-visible:ring-2"
          >
            <FileText className="h-4 w-4 text-red-600 dark:text-red-400" aria-hidden="true" />
            Routine PDF
          </a>
        ) : (
          <button
            type="button"
            onClick={pickPdf}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring pointer-coarse:py-2 inline-flex items-center gap-1.5 rounded hover:underline focus-visible:outline-none focus-visible:ring-2"
          >
            <FileUp className="h-4 w-4" aria-hidden="true" />
            Not uploaded
          </button>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-0.5">
          <ActionButton
            action="edit"
            iconOnly
            className="pointer-coarse:h-11 pointer-coarse:w-11"
            onClick={() => onEdit(exam)}
          />
          {/* modal={false}: items open dialogs; a modal menu would leave pointer-events locked */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <ActionButton
                iconOnly
                label="More actions"
                icon={<MoreHorizontal size={16} />}
                className="pointer-coarse:h-11 pointer-coarse:w-11"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="truncate normal-case tracking-normal">
                {exam.exam_name}
              </DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => onTogglePublish(exam)}>
                {exam.visible ? <EyeOff /> : <Eye />}
                {exam.visible ? 'Hide results' : 'Publish results'}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onEdit(exam)}>
                <Pencil /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {routineUrl ? (
                <>
                  <DropdownMenuItem asChild>
                    <a href={routineUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink /> View routine PDF
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href={downloadUrl ?? routineUrl} target="_blank" rel="noopener noreferrer">
                      <Download /> Download routine
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={uploading} onSelect={pickPdf}>
                    <FileUp /> Replace routine PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onSelect={() => setConfirm('pdf')}>
                    <Trash2 /> Remove routine PDF
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem disabled={uploading} onSelect={pickPdf}>
                  <FileUp /> Upload routine PDF
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirm('exam')}>
                <Trash2 /> Delete exam
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <ConfirmationPopup
          open={confirm !== null}
          onOpenChange={(o) => !o && setConfirm(null)}
          title={confirm === 'pdf' ? 'Remove routine PDF?' : 'Delete this exam?'}
          confirmLabel={confirm === 'pdf' ? 'Remove PDF' : 'Delete exam'}
          msg={
            confirm === 'pdf'
              ? 'Students will no longer see this routine until you upload another.'
              : `Delete “${exam.exam_name}”? Marks and cached marksheets for this exam are removed.`
          }
          onConfirm={() => {
            if (confirm === 'pdf') void handleRemovePdf();
            else deleteExam.mutate(exam.id);
            setConfirm(null);
          }}
        />
      </td>
    </tr>
  );
}
