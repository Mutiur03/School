import { AlertTriangle, CheckCircle2, CircleDashed, GraduationCap, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { PromotionYearStats } from '@/queries/promotion.queries';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const ranText = (run: PromotionYearStats['promotion_run']) =>
  run ? `${when(run.ran_at)}${run.ran_by ? ` · by ${run.ran_by}` : ''}` : 'date not recorded';

/** Next to the session picker: is this session already promoted / graduated? */
export function PromotionBadges({ stats }: { stats?: PromotionYearStats }) {
  if (!stats) return null;
  const graduated = stats.class10.graduated > 0;
  return (
    <>
      {stats.promoted ? (
        <Badge
          variant="outline"
          className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
          title={`Promoted ${ranText(stats.promotion_run)}`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Promoted → {stats.newYear}
        </Badge>
      ) : (
        <Badge variant="outline" className="text-muted-foreground gap-1">
          <CircleDashed className="h-3.5 w-3.5" aria-hidden="true" /> Not promoted yet
        </Badge>
      )}
      {graduated ? (
        <Badge
          variant="outline"
          className="gap-1 border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200"
          title={`Graduated ${ranText(stats.graduation_run)}`}
        >
          <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" /> Class 10 graduated
        </Badge>
      ) : null}
    </>
  );
}

const Line = ({
  icon,
  title,
  meta,
  tone,
}: {
  icon: ReactNode;
  title: ReactNode;
  meta: ReactNode;
  tone: 'done' | 'todo';
}) => (
  <div className="flex min-w-0 items-start gap-2.5">
    <span className={cn('mt-0.5', tone === 'done' ? 'text-emerald-600' : 'text-muted-foreground')}>
      {icon}
    </span>
    <div className="min-w-0">
      <p className={cn('text-sm font-semibold', tone === 'todo' && 'text-muted-foreground')}>
        {title}
      </p>
      <p className="text-muted-foreground text-xs tabular-nums">{meta}</p>
    </div>
  </div>
);

/** Above the step cards: when each run happened, who ran it, and what still needs attention. */
export function PromotionStatus({ stats }: { stats?: PromotionYearStats }) {
  if (!stats || (!stats.promoted && stats.class10.graduated === 0)) return null;
  const { newYear, awaiting_roll: waiting, unplaced } = stats;
  const graduated = stats.class10.graduated;

  return (
    <section
      aria-label="Promotion status"
      className="border-border bg-card mb-6 rounded-xl border p-4 shadow-sm"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {stats.promoted ? (
          <Line
            tone="done"
            icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
            title={`Classes 6–9 promoted to ${newYear}`}
            meta={
              <>
                {ranText(stats.promotion_run)} · {stats.next_year_enrollments} active students in{' '}
                {newYear}
              </>
            }
          />
        ) : (
          <Line
            tone="todo"
            icon={<Users className="h-5 w-5" aria-hidden="true" />}
            title="Classes 6–9 not promoted yet"
            meta="Generate pass/fail, then Review & promote."
          />
        )}
        {graduated > 0 ? (
          <Line
            tone="done"
            icon={<GraduationCap className="h-5 w-5" aria-hidden="true" />}
            title={`Class 10 graduated · ${graduated} alumni`}
            meta={ranText(stats.graduation_run)}
          />
        ) : (
          <Line
            tone="todo"
            icon={<GraduationCap className="h-5 w-5" aria-hidden="true" />}
            title="Class 10 not graduated yet"
            meta="Review & graduate when class 10 results are final."
          />
        )}
      </div>

      {stats.promoted && (waiting > 0 || unplaced > 0) ? (
        <ul className="mt-3 space-y-1.5 border-t pt-3 text-sm">
          {waiting > 0 ? (
            <li className="flex gap-2 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                <strong>
                  {waiting} failed class-6 student{waiting === 1 ? '' : 's'}
                </strong>{' '}
                still {waiting === 1 ? 'has' : 'have'} no {newYear} roll. Import the admissions,
                then click <strong>Assign retained</strong>.
              </span>
            </li>
          ) : null}
          {unplaced > 0 ? (
            <li className="flex gap-2 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                <strong>
                  {unplaced} student{unplaced === 1 ? '' : 's'}
                </strong>{' '}
                with a result {unplaced === 1 ? 'has' : 'have'} no {newYear} class yet (results
                changed after promotion). Run <strong>Review &amp; promote</strong> again — only
                auto-promoted students are renumbered.
              </span>
            </li>
          ) : null}
        </ul>
      ) : null}
    </section>
  );
}
