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
import type { PromotionPreview } from '@/queries/promotion.queries';

function SummaryStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-muted/40 rounded-lg border px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="space-y-1 px-6 pt-6 pb-4">
          <DialogTitle>
            Promotion preview · {preview?.year ?? '…'} → {preview?.newYear ?? '…'}
          </DialogTitle>
          <DialogDescription>
            Dry run — nothing is saved until you confirm. Odd merit → section A, even → B.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-4">
          {loading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Calculating assignments…
            </div>
          ) : preview && summary ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <SummaryStat label="Students" value={summary.total} />
                <SummaryStat label="Promoted (passed)" value={summary.passed_promoted} />
                <SummaryStat label="Retained (failed)" value={summary.failed_retained} />
                <SummaryStat
                  label="Sec A / B"
                  value={`${summary.section_a} / ${summary.section_b}`}
                />
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
                    No subjects found for {preview.newYear} — they will be cloned from{' '}
                    {preview.year} on confirm.
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 font-medium">Student</th>
                      <th className="hidden px-3 py-2 font-medium sm:table-cell">From</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 text-center font-medium">Merit</th>
                      <th className="px-3 py-2 font-medium">→ Next year</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.students.map((row) => (
                      <tr key={row.enrollment_id} className="hover:bg-muted/20">
                        <td className="max-w-[10rem] truncate px-3 py-2 font-medium">{row.name}</td>
                        <td className="text-muted-foreground hidden px-3 py-2 tabular-nums sm:table-cell">
                          {row.class}
                          {row.section}·{row.roll}
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
                        <td className="px-3 py-2 tabular-nums">
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

        <DialogFooter className="border-t px-6 py-4">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
