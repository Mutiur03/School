/**
 * Year-End Promotion page logic (dashboard/src/pages/Admin/GenerateResult.tsx +
 * queries/promotion.queries.ts), kept pure so texts and ordering are unit-tested.
 */
import type {
  CorrectionKey,
  CorrectionsPreview,
  CorrectionsResult,
  GenerateResultsOutcome,
  PassRule,
  Placement,
  PromotionStats,
  RunInfo,
  StudentRow,
} from '@/lib/api';

const s = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

/** "6: 0 · 7: 1 · …" */
export const passRulesSummary = (rules: readonly PassRule[]) =>
  rules.map((r) => `${r.class}: ${r.max_failed}`).join(' · ');

export const rulesByClass = (rules: readonly PassRule[]): Record<number, number> =>
  Object.fromEntries(rules.map((r) => [r.class, r.max_failed]));

/** Default table order: merit (unranked last), then class, section, roll. */
export function meritOrder(rows: readonly StudentRow[]): StudentRow[] {
  return [...rows].sort(
    (a, b) =>
      (a.final_merit || 9999) - (b.final_merit || 9999) ||
      a.class - b.class ||
      (a.section || '').localeCompare(b.section || '') ||
      (a.roll || 0) - (b.roll || 0),
  );
}

/** "2/3" failed subjects / allowed; "—" before pass/fail ran. */
export const failsText = (row: StudentRow, rules: Record<number, number>) =>
  row.fail_count === null ? '—' : `${row.fail_count}/${rules[row.class] ?? 0}`;

export const nextSecRoll = (row: StudentRow) =>
  row.next_year_section || row.next_year_roll
    ? `${row.next_year_section || '—'} · ${row.next_year_roll || '—'}`
    : '—';

export function yearSummary(stats: PromotionStats | undefined, year: number): string {
  const p = stats?.promotion;
  return p
    ? `${p.total.toLocaleString()} in classes 6–9 · ${p.passed} passed · ${p.failed} failed · ${p.pending} pending · promotes into ${year + 1}`
    : `Promotes into ${year + 1}`;
}

export function stepState(stats: PromotionStats | undefined) {
  const p = stats?.promotion;
  const c10 = stats?.class10;
  return {
    passFailGenerated: (p?.passed ?? 0) + (p?.failed ?? 0) > 0,
    promoted: stats?.promoted ?? false,
    awaitingRoll: stats?.awaiting_roll ?? 0,
    nextYearTotal: stats?.next_year_enrollments ?? 0,
    class10Done: (stats?.graduated ?? false) || (c10?.graduated ?? 0) > 0 || c10?.total === 0,
    awaitingRetain: stats?.awaiting_retain ?? 0,
  };
}

export function promotionDetail(stats: PromotionStats | undefined, year: number): string {
  const { awaitingRoll, nextYearTotal } = stepState(stats);
  return [
    `Classes 6–9 → ${year + 1}.`,
    awaitingRoll > 0
      ? `${awaitingRoll} failed class-6 student${awaitingRoll === 1 ? '' : 's'} have no roll yet — import admissions, then assign.`
      : null,
    nextYearTotal === 0
      ? 'No enrollments there yet — safe to promote.'
      : `${s(nextYearTotal, 'enrollment')} exist — re-running replaces the promoted students’ rows.`,
  ]
    .filter(Boolean)
    .join(' ');
}

export function graduationDetail(stats: PromotionStats | undefined): string {
  const c = stats?.class10;
  if (!c)
    return 'Mark passed SSC students graduated; failed students are held until you retain them in class 10.';
  if (c.total === 0) return 'No active class-10 students for this year.';
  if (stats?.graduated) {
    return `${c.passed} passed · ${c.failed} failed (held until retained in class 10)`;
  }
  if (c.graduated > 0) return `${c.graduated} graduated · ${c.passed} pending · ${c.failed} failed`;
  return `${c.total} active · ${c.passed} passed · ${c.failed} failed`;
}

export const generateConfirmText = (year: number, rules: readonly PassRule[]) =>
  `Recalculate pass/fail for all students in ${year} from year-end marks.\n\nAllowed failed subjects by class — ${passRulesSummary(rules)}.\n\nManual pass/fail overrides are kept.`;

export interface Messages {
  success: string;
  errors: string[];
}

export function generateMessages(o: GenerateResultsOutcome): Messages {
  const errors: string[] = [];
  if (o.missingYearEnd.length)
    errors.push(`Skipped class ${o.missingYearEnd.join(', ')}: no year-end exam`);
  if (o.missingPrevious.length)
    errors.push(`Skipped class ${o.missingPrevious.join(', ')}: no exam before the year-end exam`);
  return {
    success:
      o.passed !== null && o.failed !== null
        ? `Pass/fail updated: ${o.passed} passed, ${o.failed} failed`
        : 'Pass/fail status generated',
    errors,
  };
}

export function promoteMessages(r: {
  promoted: number | null;
  awaitingRoll: number;
  skipped: number;
  newYear: number;
}): Messages {
  const errors: string[] = [];
  if (r.awaitingRoll)
    errors.push(`${r.awaitingRoll} failed class-6 students wait for "Assign retained"`);
  if (r.skipped) errors.push(`${r.skipped} skipped (status not Passed/Failed)`);
  return {
    success:
      r.promoted !== null
        ? `Promotion complete: ${r.promoted} students → ${r.newYear}`
        : 'Promotion completed',
    errors,
  };
}

export const graduateMessage = (r: { graduated: number | null; held: number }) =>
  r.graduated !== null
    ? `Graduation complete: ${r.graduated} passed, ${r.held} held`
    : 'Graduation complete';

export const holdConfirm = (name: string, held: boolean, year: number) =>
  held
    ? {
        title: 'Release result?',
        message: `${name}'s result is generated now and ranked after everyone already released, so no earlier merit position moves.

If promotion for ${year + 1} already ran, they are added at the end of their next class right away; nobody else moves.`,
        confirmLabel: 'Release',
      }
    : {
        title: 'Hold result?',
        message: `${name}'s status goes back to Pending and they are not ranked, promoted or graduated until released.

If promotion for ${year + 1} already ran, their ${year + 1} class row is removed (refused if it already has marks).`,
        confirmLabel: 'Hold',
      };

/** "Use calculated result?" confirm for a student whose status was set by hand. */
export const calculatedConfirm = (name: string, status: string, year: number) => ({
  title: 'Use calculated result?',
  message: `${name}'s manual ${status} is removed and the result is worked out from marks again.

If promotion for ${year + 1} already ran and the result changes, they are moved to the end of their next class; nobody else moves.`,
  confirmLabel: 'Use calculated result',
});

export const skippedText = (n: number) =>
  `${s(n, 'student')} skipped: status is not Passed or Failed. Generate results or set their status first.`;

/** The web keeps the last 5 sessions. */
export const promotionYears = (current: number) => Array.from({ length: 5 }, (_, i) => current - i);

/** One line for confirms/toasts: where a changed result puts the student next year; null = nothing changes. */
export function placementText(p: Placement, nextYear: number): string | null {
  switch (p.action) {
    case 'remove':
      return `${p.name}'s ${nextYear} class row will be removed (not promoted).`;
    case 'graduate':
      return `${p.name} will be graduated and their ${nextYear} class 10 row removed.`;
    case 'move':
      return p.new_roll == null
        ? `${p.name} will stay in class ${p.new_class}${p.new_section} for ${nextYear} without a roll until you click Assign retained.`
        : `${p.name} will move to class ${p.new_class}${p.new_section}, roll ${p.new_roll} for ${nextYear} (end of the section; nobody else moves).`;
    default:
      return null;
  }
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** "4 Oct 2026, 10:30 · by Admin", or "date not recorded" for runs from before runs were stored. */
export const runText = (run: RunInfo | null) =>
  run ? `${when(run.ran_at)}${run.ran_by ? ` · by ${run.ran_by}` : ''}` : 'date not recorded';

export interface CorrectionOption {
  key: CorrectionKey;
  title: string;
  /** What happens, from the dry run. */
  effect: (p: CorrectionsPreview) => string;
  /** Next-year rows with marks that block this option. */
  blocked?: (p: CorrectionsPreview) => number;
  unavailable: string;
}

export const CORRECTION_OPTIONS: readonly CorrectionOption[] = [
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

/** Total next-year rows with marks across the chosen options (> 0 blocks Apply). */
export const blockedCount = (
  p: CorrectionsPreview,
  chosen: Partial<Record<CorrectionKey, boolean>>,
) => CORRECTION_OPTIONS.reduce((n, o) => n + (chosen[o.key] ? (o.blocked?.(p) ?? 0) : 0), 0);

/** Toast lines: the headline first, then what each chosen option did. */
export function correctionsMessages(
  r: CorrectionsResult,
  options: Partial<Record<CorrectionKey, boolean>>,
): string[] {
  const lines = [
    options.reset_promotion &&
      `Promotion reset: ${s(r.promotion_rows_removed, 'next-year place')} removed. Run Review & promote when ready.`,
    options.undo_graduation &&
      `Graduation undone: ${s(r.graduation_undone, 'student')} active again, ${s(r.graduation_rows_removed, 'class-10 place')} removed.`,
    options.clear_manual &&
      `${s(r.manual_cleared, 'manual pass/fail', 'manual pass/fail')} cleared.`,
    options.reset_release_batches && `${s(r.batches_reset, 'late result')} now rank by marks.`,
    r.regenerated && 'Pass/fail and positions recalculated from marks.',
    r.placements.length > 0 &&
      `${s(r.placements.length, 'student')} moved next year because the result changed.`,
  ].filter((x): x is string => typeof x === 'string');
  return ['Corrections applied.', ...lines];
}
