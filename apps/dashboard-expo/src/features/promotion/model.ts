/**
 * Year-End Promotion page logic (dashboard/src/pages/Admin/GenerateResult.tsx +
 * queries/promotion.queries.ts), kept pure so texts and ordering are unit-tested.
 */
import type { GenerateResultsOutcome, PassRule, PromotionStats, StudentRow } from '@/lib/api';

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
    class10Done: (c10?.graduated ?? 0) > 0 || c10?.total === 0,
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
  if (!c) return 'Graduate passed SSC students to alumni; retain failed students in class 10.';
  if (c.total === 0) return 'No active class-10 students for this year.';
  if (c.graduated > 0) return `${c.graduated} graduated · ${c.passed} pending · ${c.failed} failed`;
  return `${c.total} active · ${c.passed} passed · ${c.failed} failed`;
}

export const generateConfirmText = (year: number, rules: readonly PassRule[]) =>
  `Recalculate pass/fail for all students in ${year} from year-end marks.\n\nAllowed failed subjects by class — ${passRulesSummary(rules)}.\n\nManual overrides may be overwritten.`;

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

export const graduateMessage = (r: { graduated: number | null; retained: number }) =>
  r.graduated !== null
    ? `Graduation complete: ${r.graduated} alumni, ${r.retained} retained`
    : 'Graduation complete';

export const holdConfirm = (name: string, held: boolean) =>
  held
    ? {
        title: 'Release result?',
        message: `${name}'s result is generated now and ranked after everyone already released, so no earlier merit position moves.`,
        confirmLabel: 'Release',
      }
    : {
        title: 'Hold result?',
        message: `${name}'s status goes back to Pending and they are not ranked, promoted or graduated until released.`,
        confirmLabel: 'Hold',
      };

export const skippedText = (n: number) =>
  `${s(n, 'student')} skipped: status is not Passed or Failed. Generate results or set their status first.`;

/** The web keeps the last 5 sessions. */
export const promotionYears = (current: number) => Array.from({ length: 5 }, (_, i) => current - i);
