import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popup } from '@/components';
import { cn } from '@/lib/utils';
import {
  useApplyCorrections,
  useCorrectionsPreview,
  type CorrectionKey,
  type CorrectionsPreview,
} from '@/queries/promotion.queries';
import { CloseButton } from '@/pages/Admin/PromotionPreviewDialog';

type Option = {
  key: CorrectionKey;
  title: string;
  /** What happens, from the dry run. */
  effect: (p: CorrectionsPreview) => string;
  /** Next-year rows with marks that block this option. */
  blocked?: (p: CorrectionsPreview) => number;
  unavailable: string;
};

const OPTIONS: Option[] = [
  {
    key: 'reset_promotion',
    title: 'Reset promotion (classes 6–9)',
    effect: (p) =>
      `Removes ${p.reset_promotion.rows} ${p.newYear} class place(s) created by promoting ${p.year}. New admissions stay. The page goes back to "Not promoted yet" — then Review & promote again for a fresh placement.`,
    blocked: (p) => p.reset_promotion.with_marks,
    unavailable: 'Not promoted yet.',
  },
  {
    key: 'undo_graduation',
    title: 'Undo class 10 graduation',
    effect: (p) =>
      `${p.undo_graduation.graduated} alumni become active class-10 students (Passed) again, and ${p.undo_graduation.rows} retained class-10 place(s) in ${p.newYear} are removed.`,
    blocked: (p) => p.undo_graduation.with_marks,
    unavailable: 'Class 10 is not graduated.',
  },
  {
    key: 'clear_manual',
    title: 'Clear manual pass/fail',
    effect: (p) =>
      `${p.clear_manual.students} student(s) set by hand get their result from marks again. If promotion stays, anyone whose result changes is moved next year.`,
    unavailable: 'No manual pass/fail set.',
  },
  {
    key: 'reset_release_batches',
    title: 'Rank late-released results by marks',
    effect: (p) =>
      `${p.reset_release_batches.students} late-released result(s) rank among on-time results by marks. Published positions can change.`,
    unavailable: 'No late-released results.',
  },
];

export function CorrectionsDialog({
  year,
  open,
  onOpenChange,
}: {
  year: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: preview, isLoading } = useCorrectionsPreview(year, open);
  const { mutate: apply, isPending } = useApplyCorrections();
  const [chosen, setChosen] = useState<Partial<Record<CorrectionKey, boolean>>>({});

  const picked = OPTIONS.filter((o) => chosen[o.key]);
  const blocked = preview ? picked.reduce((n, o) => n + (o.blocked?.(preview) ?? 0), 0) : 0;
  const close = (next: boolean) => {
    if (!next) setChosen({});
    onOpenChange(next);
  };

  return (
    <Popup
      open={open}
      onOpenChange={close}
      size="lg"
      className="sm:max-w-2xl"
      aria-labelledby="corrections-title"
    >
      <div className="border-border flex items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 id="corrections-title" className="text-base font-semibold">
            Correct mistakes · session {year}
          </h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Choose one or more. Nothing changes until you apply, and marks already entered in the
            next year are never deleted.
          </p>
        </div>
        <CloseButton onClick={() => close(false)} />
      </div>

      <div className="max-h-[65vh] space-y-3 overflow-y-auto px-5 py-4">
        {isLoading || !preview ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Checking what can be
            corrected…
          </div>
        ) : (
          OPTIONS.map((o) => {
            const available = preview[o.key].available;
            const marks = o.blocked?.(preview) ?? 0;
            const id = `correction-${o.key}`;
            return (
              <label
                key={o.key}
                htmlFor={id}
                className={cn(
                  'border-border flex gap-3 rounded-lg border p-3',
                  available ? 'hover:bg-muted/50 cursor-pointer' : 'opacity-60',
                  chosen[o.key] && 'border-primary bg-primary/5',
                )}
              >
                <Checkbox
                  id={id}
                  className="mt-0.5"
                  disabled={!available || isPending}
                  checked={!!chosen[o.key]}
                  onCheckedChange={(v) => setChosen((c) => ({ ...c, [o.key]: v === true }))}
                />
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">{o.title}</p>
                  <p className="text-muted-foreground mt-0.5">
                    {available ? o.effect(preview) : o.unavailable}
                  </p>
                  {available && marks > 0 ? (
                    <p className="text-destructive mt-1 font-medium">
                      Blocked: {marks} of those {preview.newYear} place(s) already have marks.
                      Remove those marks first.
                    </p>
                  ) : null}
                </div>
              </label>
            );
          })
        )}

        {blocked > 0 ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Uncheck the blocked option or remove the marks first — nothing will be changed while
              it is selected.
            </AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="border-border flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3">
        <Button type="button" variant="outline" onClick={() => close(false)} disabled={isPending}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={!picked.length || blocked > 0 || isPending}
          onClick={() => apply({ year, options: chosen }, { onSuccess: () => close(false) })}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Applying…
            </>
          ) : (
            `Apply ${picked.length || ''} correction${picked.length === 1 ? '' : 's'}`
          )}
        </Button>
      </div>
    </Popup>
  );
}
