/**
 * Background marksheet generation status, verified against server marksheets.controller.ts:
 *
 *   GET /api/marksheets/exams/:examId/status   admin/teacher (Nest, no-store; the exam is looked
 *       up in the caller's school). Like the web, a read also queues a due-but-unqueued exam.
 *       → { pending, generating, ready, failed, skipped, total, done,
 *           bundles: { …same, stale, staleItems: [{ class, section }],
 *                      failedItems: [{ class, section, error }] } }
 *       Unpublished exams report zeros.
 *
 * The helpers mirror dashboard/src/queries/marks.queries.ts (isMarksheetGenComplete,
 * isMarksheetQueueActive, hasStaleBundles, formatBundleScope and the poll interval).
 */
import { isObj, num, str } from './parse';

export interface BundleScope {
  class: number;
  section: string;
}
export interface GenTally {
  pending: number;
  generating: number;
  ready: number;
  failed: number;
  skipped: number;
  total: number;
  done: number;
}
export interface MarksheetGenStatus extends GenTally {
  bundles: GenTally & {
    stale: number;
    staleItems: BundleScope[];
    failedItems: (BundleScope & { error: string })[];
  };
}

export const marksheetStatusPath = (examId: number) => `/api/marksheets/exams/${examId}/status`;

export const MARKSHEET_POLL_MS = 8_000;
export const MARKSHEET_STALE_POLL_MS = 60_000;

const count = (v: unknown) => Math.max(0, num(v, 0));
function tally(v: Record<string, unknown>): GenTally {
  return {
    pending: count(v.pending),
    generating: count(v.generating),
    ready: count(v.ready),
    failed: count(v.failed),
    skipped: count(v.skipped),
    total: count(v.total),
    done: count(v.done),
  };
}
const scopes = (v: unknown) =>
  (Array.isArray(v) ? v : [])
    .filter(isObj)
    .map((x) => ({ class: num(x.class), section: str(x.section), error: str(x.error) }))
    .filter((x) => x.class > 0);

export function parseMarksheetStatus(v: unknown): MarksheetGenStatus {
  const o = isObj(v) ? v : {};
  const b = isObj(o.bundles) ? o.bundles : {};
  return {
    ...tally(o),
    bundles: {
      ...tally(b),
      stale: count(b.stale),
      staleItems: scopes(b.staleItems).map(({ class: c, section }) => ({ class: c, section })),
      failedItems: scopes(b.failedItems),
    },
  };
}

export const isGenComplete = (s?: MarksheetGenStatus | null) =>
  !!s &&
  s.total > 0 &&
  s.done >= s.total &&
  s.pending === 0 &&
  s.generating === 0 &&
  (s.bundles.total === 0 ||
    (s.bundles.pending === 0 && s.bundles.generating === 0 && s.bundles.done >= s.bundles.total));

export const isQueueActive = (s?: MarksheetGenStatus | null) =>
  !!s && s.pending + s.generating + s.bundles.pending + s.bundles.generating > 0;

export const hasStaleBundles = (s?: MarksheetGenStatus | null) => (s?.bundles.stale ?? 0) > 0;

export const formatBundleScope = (b: BundleScope) =>
  b.section === 'ALL' ? `Class ${b.class} (all sections)` : `Class ${b.class} (${b.section})`;

/** refetchInterval: 8 s while running, 60 s while bundles are stale, otherwise stop. */
export function marksheetPollMs(s?: MarksheetGenStatus | null): number | false {
  if (!s || s.total === 0) return false;
  if (hasStaleBundles(s)) return MARKSHEET_STALE_POLL_MS;
  return isGenComplete(s) ? false : MARKSHEET_POLL_MS;
}

/** What the panel shows; shared by the full and compact variants (web MarksheetGenProgress). */
export function genPanelView(s: MarksheetGenStatus) {
  const complete = isGenComplete(s);
  const studentBusy = s.pending + s.generating > 0;
  const bundleBusy = s.bundles.pending + s.bundles.generating > 0;
  const bundlesOnly = bundleBusy && !studentBusy;
  const pct = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 100) : 0);
  const stale = s.bundles.stale > 0 && !bundleBusy ? s.bundles.staleItems : [];
  return {
    complete,
    active: isQueueActive(s),
    title: complete
      ? 'Marksheets ready'
      : bundlesOnly
        ? 'Generating class bundles in background'
        : 'Generating marksheets in background',
    compactTitle: complete
      ? 'Marksheets ready'
      : bundlesOnly
        ? 'Class bundles'
        : 'Generating marksheets',
    count: bundlesOnly ? `${s.bundles.done}/${s.bundles.total}` : `${s.done}/${s.total}`,
    percent:
      bundlesOnly && s.bundles.total > 0
        ? pct(s.bundles.done, s.bundles.total)
        : pct(s.done, s.total),
    showBundles: s.bundles.total > 0 || s.bundles.stale > 0 || bundleBusy,
    bundleLabel: bundleBusy
      ? 'Class bundles generating'
      : s.bundles.stale > 0
        ? 'Class bundles outdated'
        : s.bundles.total > 0 && s.bundles.done >= s.bundles.total
          ? 'Class bundles ready'
          : 'Class bundles',
    bundleCount: s.bundles.total > 0 ? `${s.bundles.done}/${s.bundles.total}` : '',
    bundleProgress: bundleBusy && studentBusy && s.bundles.total > 0,
    stale,
  };
}
