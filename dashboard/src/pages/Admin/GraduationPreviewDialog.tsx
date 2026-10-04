import { AlertTriangle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popup } from '@/components';
import { cn } from '@/lib/utils';
import type { GraduationPreview } from '@/queries/promotion.queries';
import {
  CloseButton,
  ResultBadge,
  Stat,
  thClass,
  theadRowClass,
} from '@/pages/Admin/PromotionPreviewDialog';

function ActionBadge({ action }: { action: 'graduate' | 'retain' }) {
  if (action === 'graduate') {
    return (
      <Badge
        variant="outline"
        className="border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-300"
      >
        Graduate
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-300"
    >
      Retain cl 10
    </Badge>
  );
}

export function GraduationPreviewDialog({
  open,
  preview,
  loading,
  committing,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  preview: GraduationPreview | null;
  loading?: boolean;
  committing?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const summary = preview?.summary;

  return (
    <Popup
      open={open}
      onOpenChange={onOpenChange}
      size="2xl"
      className="sm:max-w-3xl"
      aria-labelledby="graduation-preview-title"
    >
      <div className="border-border flex items-start justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <h2 id="graduation-preview-title" className="text-base font-semibold">
            Class 10 graduation · {preview?.year ?? '…'} (SSC {preview?.sscBatch ?? '…'})
          </h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Passed students are marked alumni (batch {preview?.sscBatch ?? '…'}, inactive). Failed
            students stay in class 10 for {preview?.newYear ?? '…'} with new rolls.
          </p>
        </div>
        <CloseButton onClick={() => onOpenChange(false)} />
      </div>

      <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Calculating graduation…
          </div>
        ) : preview && summary ? (
          <>
            <div className="grid grid-cols-3 gap-4">
              <Stat label="Class 10" value={summary.total} />
              <Stat label="Graduate" value={summary.graduates} dot="bg-sky-500" />
              <Stat label="Retain" value={summary.retained} dot="bg-amber-500" />
            </div>

            {summary.existing_class10_next_year > 0 ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {summary.existing_class10_next_year} class-10 enrollment
                  {summary.existing_class10_next_year === 1 ? '' : 's'} already in {preview.newYear}{' '}
                  — retained students will be updated, not duplicated.
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="border-border overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
                <thead>
                  <tr className={theadRowClass}>
                    <th className={thClass}>Student</th>
                    <th className={thClass}>From</th>
                    <th className={thClass}>Result</th>
                    <th className={cn(thClass, 'text-center')}>Merit</th>
                    <th className={thClass}>Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {preview.students.map((row) => (
                    <tr key={row.enrollment_id}>
                      <td className="max-w-[12rem] truncate px-3 py-2 font-medium">{row.name}</td>
                      <td className="text-muted-foreground whitespace-nowrap px-3 py-2 tabular-nums">
                        10{row.section}·{row.roll}
                      </td>
                      <td className="px-3 py-2">
                        <ResultBadge status={row.status} />
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums">
                        {row.final_merit || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col items-start gap-1">
                          <ActionBadge action={row.action} />
                          <span className="text-muted-foreground text-xs tabular-nums">
                            {row.action === 'graduate'
                              ? row.ssc_batch
                                ? `SSC batch ${row.ssc_batch}`
                                : '—'
                              : row.new_section && row.new_roll
                                ? `${preview.newYear}: 10${row.new_section}${row.new_roll}`
                                : '—'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground py-8 text-center text-sm">No preview data.</p>
        )}
      </div>

      <div className="border-border flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={committing}
        >
          Cancel
        </Button>
        <Button type="button" disabled={loading || !preview || committing} onClick={onConfirm}>
          {committing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Graduating…
            </>
          ) : (
            `Confirm graduation (SSC ${preview?.sscBatch ?? ''})`
          )}
        </Button>
      </div>
    </Popup>
  );
}
