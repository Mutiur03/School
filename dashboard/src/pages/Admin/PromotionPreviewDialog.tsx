import { AlertTriangle, Loader2, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popup } from '@/components';
import { cn } from '@/lib/utils';
import type { PromotionPreview } from '@/queries/promotion.queries';

export const CloseButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Close"
    className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring pointer-coarse:p-2.5 rounded-md p-1 transition-colors focus-visible:outline-none focus-visible:ring-2"
  >
    <X className="h-4 w-4" />
  </button>
);

export const Stat = ({
  label,
  value,
  dot,
}: {
  label: string;
  value: number | string;
  dot?: string;
}) => (
  <div className="min-w-0">
    <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dot)} aria-hidden />}
      {label}
    </p>
    <p className="mt-0.5 text-xl font-semibold tabular-nums">
      {typeof value === 'number' ? value.toLocaleString() : value}
    </p>
  </div>
);

export const theadRowClass =
  'border-border border-b [&>th:first-child]:rounded-tl-[calc(var(--radius)+3px)] [&>th:last-child]:rounded-tr-[calc(var(--radius)+3px)] [&>th]:bg-muted';
export const thClass =
  'text-foreground/70 px-3 py-2 text-xs font-semibold uppercase tracking-wider whitespace-nowrap';

export const ResultBadge = ({ status }: { status: string }) => (
  <Badge
    variant="outline"
    className={
      status === 'Passed'
        ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
        : 'border-red-500/40 text-red-700 dark:text-red-400'
    }
  >
    {status}
  </Badge>
);

export function PromotionPreviewDialog({
  open,
  preview,
  loading,
  committing,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  preview: PromotionPreview | null;
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
      aria-labelledby="promotion-preview-title"
    >
      <div className="border-border flex items-start justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <h2 id="promotion-preview-title" className="text-base font-semibold">
            Promotion preview · {preview?.year ?? '…'} → {preview?.newYear ?? '…'}
          </h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Dry run — nothing is saved until you confirm. Odd merit → section A, even → B.
          </p>
        </div>
        <CloseButton onClick={() => onOpenChange(false)} />
      </div>

      <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Calculating assignments…
          </div>
        ) : preview && summary ? (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Students" value={summary.total} />
              <Stat label="Promoted" value={summary.passed_promoted} dot="bg-emerald-500" />
              <Stat label="Retained" value={summary.failed_retained} dot="bg-red-500" />
              <Stat label="Sec A / B" value={`${summary.section_a} / ${summary.section_b}`} />
            </div>

            {summary.existing_next_year_enrollments > 0 ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {summary.existing_next_year_enrollments} enrollment
                  {summary.existing_next_year_enrollments === 1 ? '' : 's'} in {preview.newYear}{' '}
                  will be <strong>deleted and replaced</strong>.
                </AlertDescription>
              </Alert>
            ) : null}

            {summary.subjects_will_clone ? (
              <Alert>
                <AlertDescription>
                  No subjects found for {preview.newYear} — they will be cloned from {preview.year}{' '}
                  on confirm.
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="border-border overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
                <thead>
                  <tr className={theadRowClass}>
                    <th className={thClass}>Student</th>
                    <th className={thClass}>From</th>
                    <th className={thClass}>Status</th>
                    <th className={cn(thClass, 'text-center')}>Merit</th>
                    <th className={thClass}>→ Next year</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {preview.students.map((row) => (
                    <tr key={row.enrollment_id}>
                      <td className="max-w-[12rem] truncate px-3 py-2 font-medium">{row.name}</td>
                      <td className="text-muted-foreground whitespace-nowrap px-3 py-2 tabular-nums">
                        {row.class}
                        {row.section}·{row.roll}
                      </td>
                      <td className="px-3 py-2">
                        <ResultBadge status={row.status} />
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums">
                        {row.final_merit || '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                        Cl {row.new_class} · {row.new_section}
                        {row.new_roll}
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
        <Button
          type="button"
          variant="destructive"
          disabled={loading || !preview || committing}
          onClick={onConfirm}
        >
          {committing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Promoting…
            </>
          ) : (
            `Confirm promote to ${preview?.newYear ?? 'next year'}`
          )}
        </Button>
      </div>
    </Popup>
  );
}
