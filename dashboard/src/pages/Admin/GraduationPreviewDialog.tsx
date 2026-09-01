import { AlertTriangle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { GraduationPreview } from '@/queries/promotion.queries';

function SummaryStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-muted/40 rounded-lg border px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ActionBadge({ action }: { action: 'graduate' | 'retain' }) {
  if (action === 'graduate') {
    return (
      <Badge variant="outline" className="border-sky-500/40 bg-sky-500/10 text-sky-800">
        Graduate
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-900">
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="space-y-1 px-6 pt-6 pb-4">
          <DialogTitle>
            Class 10 graduation · {preview?.year ?? '…'} (SSC {preview?.sscBatch ?? '…'})
          </DialogTitle>
          <DialogDescription>
            Passed students are marked alumni (batch {preview?.sscBatch}, inactive). Failed students
            stay in class 10 for {preview?.newYear ?? '…'} with new rolls.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-4">
          {loading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Calculating graduation…
            </div>
          ) : preview && summary ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <SummaryStat label="Class 10" value={summary.total} />
                <SummaryStat label="Graduate (passed)" value={summary.graduates} />
                <SummaryStat label="Retain (failed)" value={summary.retained} />
              </div>

              {summary.existing_class10_next_year > 0 ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {summary.existing_class10_next_year} class-10 enrollment
                    {summary.existing_class10_next_year === 1 ? '' : 's'} already in{' '}
                    {preview.newYear} — retained students will be updated, not duplicated.
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 font-medium">Student</th>
                      <th className="hidden px-3 py-2 font-medium sm:table-cell">From</th>
                      <th className="px-3 py-2 font-medium">Result</th>
                      <th className="px-3 py-2 text-center font-medium">Merit</th>
                      <th className="px-3 py-2 font-medium">Outcome</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.students.map((row) => (
                      <tr key={row.enrollment_id} className="hover:bg-muted/20">
                        <td className="max-w-[10rem] truncate px-3 py-2 font-medium">{row.name}</td>
                        <td className="text-muted-foreground hidden px-3 py-2 tabular-nums sm:table-cell">
                          10{row.section}·{row.roll}
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            variant="outline"
                            className={
                              row.status === 'Passed'
                                ? 'border-emerald-500/40 text-emerald-700'
                                : 'border-red-500/40 text-red-700'
                            }
                          >
                            {row.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-center tabular-nums">{row.final_merit}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1">
                            <ActionBadge action={row.action} />
                            <span className="text-muted-foreground text-xs tabular-nums">
                              {row.action === 'graduate'
                                ? `SSC batch ${row.ssc_batch}`
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

        <DialogFooter className="border-t px-6 py-4">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
