import { formatDay, parseLocalDate } from '@/lib/utils';
import type { Exam } from '@/queries/exam.queries';

function chipDate(value: string) {
  return parseLocalDate(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function ExamSessionRail({
  exams,
  onSelect,
}: {
  exams: Exam[];
  onSelect: (examId: number) => void;
}) {
  if (exams.length === 0) return null;

  const sorted = [...exams].sort(
    (a, b) => parseLocalDate(a.start_date).getTime() - parseLocalDate(b.start_date).getTime(),
  );

  return (
    <section aria-label="Session calendar" className="mb-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Session calendar
        </p>
        <p className="text-muted-foreground text-xs tabular-nums">
          {sorted.length} exam{sorted.length === 1 ? '' : 's'}
        </p>
      </div>
      <ol className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch]">
        {sorted.map((exam) => (
          <li key={exam.id} className="min-w-0 shrink-0">
            <button
              type="button"
              onClick={() => onSelect(exam.id)}
              className={`focus-visible:ring-ring flex max-w-52 min-w-40 flex-col items-start rounded-md border px-3 py-2 text-left transition-[border-color,background-color] focus-visible:ring-2 focus-visible:outline-none ${
                exam.is_year_end
                  ? 'border-primary/40 bg-primary/5'
                  : exam.visible
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-border bg-card'
              }`}
            >
              <span className="text-muted-foreground text-[11px] tabular-nums">
                {chipDate(exam.start_date)}
                <span aria-hidden="true"> – </span>
                {chipDate(exam.end_date)}
              </span>
              <span className="text-foreground mt-0.5 w-full truncate text-sm font-medium">
                {exam.exam_name}
              </span>
              <span className="text-muted-foreground mt-1 text-[11px]">
                {exam.visible ? 'Published' : 'Draft'}
                {exam.is_year_end ? ' · Year end' : ''}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function yearEndGaps(exams: Exam[], classes = [6, 7, 8, 9, 10]): number[] {
  const active = classes.filter((level) => exams.some((exam) => exam.levels.includes(level)));
  const covered = new Set(exams.filter((exam) => exam.is_year_end).flatMap((exam) => exam.levels));
  return active.filter((level) => !covered.has(level));
}

export function formatExamRange(exam: Exam) {
  return `${formatDay(exam.start_date)} – ${formatDay(exam.end_date)}`;
}
