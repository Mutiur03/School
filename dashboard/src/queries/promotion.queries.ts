import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-hot-toast';

type Line = string | false | null | undefined;
const TOAST = { duration: 7000, style: { whiteSpace: 'pre-line' as const, maxWidth: 480 } };

/**
 * One toast per action: a headline plus detail lines. `id` makes a repeat of the same action replace
 * its toast instead of stacking. Intentional skips (held / no result) are details, never errors.
 */
export const notify = (id: string, lines: Line[], tone: 'success' | 'warning' = 'success') => {
  const text = lines.filter(Boolean).join('\n');
  return tone === 'success'
    ? toast.success(text, { ...TOAST, id })
    : toast(text, { ...TOAST, id, icon: '⚠️' });
};

/** The action itself failed. */
export const fail = (id: string, error: any, fallback: string) =>
  toast.error(error?.response?.data?.message || fallback, { ...TOAST, id });

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export type PromotionPassRule = {
  class: number;
  max_failed: number;
};

export const PROMOTION_PASS_CLASSES = [6, 7, 8, 9, 10] as const;

export const usePromotionPassRules = (year: number) => {
  return useQuery({
    queryKey: ['promotion-pass-rules', year],
    queryFn: async () => {
      const response = await axios.get(`/api/promotions/${year}/pass-rules`);
      return (response.data?.data ?? []) as PromotionPassRule[];
    },
  });
};

export const useSavePromotionPassRules = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      year,
      rules,
    }: {
      year: number;
      rules: PromotionPassRule[];
      silent?: boolean;
    }) => {
      const response = await axios.put(`/api/promotions/${year}/pass-rules`, { rules });
      return response.data?.data as PromotionPassRule[];
    },
    onSuccess: (_data, { year, silent }) => {
      queryClient.invalidateQueries({ queryKey: ['promotion-pass-rules', year] });
      if (!silent) notify('pass-rules', ['Pass rules saved.']);
    },
    onError: (error: any) => {
      fail('pass-rules', error, 'Could not save pass rules');
    },
  });
};

export type PromotionYearStats = {
  year: number;
  newYear: number;
  promotion: {
    passed: number;
    failed: number;
    pending: number;
    graduated: number;
    total: number;
  };
  class10: {
    passed: number;
    failed: number;
    pending: number;
    graduated: number;
    total: number;
  };
  promoted: boolean;
  next_year_enrollments: number;
  /** Failed class-6 students promoted without a roll, waiting for the assign button. */
  awaiting_roll: number;
  /** After promotion: Passed/Failed students still without a next-year class (results changed since). */
  unplaced: number;
  /** Last runs (null = never run, or run before runs were recorded). */
  promotion_run: { ran_at: string; ran_by: string | null } | null;
  graduation_run: { ran_at: string; ran_by: string | null } | null;
};

export const usePromotionYearStats = (year: number) => {
  return useQuery({
    queryKey: ['promotion-stats', year],
    queryFn: async () => {
      const response = await axios.get(`/api/promotions/${year}/stats`);
      return response.data?.data as PromotionYearStats;
    },
  });
};

export type PromotionPreviewRow = {
  enrollment_id: number;
  student_id: number;
  name: string;
  class: number;
  section: string;
  roll: number;
  group: string | null;
  status: string;
  gpa: number;
  final_merit: number;
  new_class: number;
  new_section: string;
  /** null = failed class-6 student; numbered later by "Assign retained". */
  new_roll: number | null;
  /** Not auto-promoted (failed, manual, late release): keeps its order after the auto block on re-runs. */
  locked: boolean;
};

/** In the year's results but left out of promotion/graduation. Inactive (TC'd) students never appear. */
export type SkippedStudent = {
  enrollment_id: number;
  name: string;
  class: number;
  section: string;
  roll: number;
  /** held = result withheld (release it); no_result = no Passed/Failed status yet (generate or set it). */
  reason: 'held' | 'no_result';
};

export type PromotionPreview = {
  year: number;
  newYear: number;
  students: PromotionPreviewRow[];
  skipped_students: SkippedStudent[];
  summary: {
    total: number;
    passed_promoted: number;
    failed_retained: number;
    awaiting_roll: number;
    /** New class-6 admissions already exist next year, so retained students are numbered immediately. */
    class6_admissions: boolean;
    skipped: number;
    section_a: number;
    section_b: number;
    existing_next_year_enrollments: number;
    subjects_will_clone: boolean;
  };
};

export type GraduationPreviewRow = {
  enrollment_id: number;
  student_id: number;
  name: string;
  section: string;
  roll: number;
  group: string | null;
  status: string;
  gpa: number;
  final_merit: number;
  action: 'graduate' | 'retain';
  ssc_batch: string | null;
  new_section: string | null;
  new_roll: number | null;
};

export type GraduationPreview = {
  year: number;
  newYear: number;
  sscBatch: string;
  students: GraduationPreviewRow[];
  skipped_students: SkippedStudent[];
  summary: {
    total: number;
    graduates: number;
    retained: number;
    skipped: number;
    existing_class10_next_year: number;
  };
};

export type EnrollmentStatus = 'Passed' | 'Failed' | 'Pending';

export const ENROLLMENT_STATUS_OPTIONS: EnrollmentStatus[] = ['Passed', 'Failed', 'Pending'];

/** Where a result change puts the student next year when promotion/graduation already ran. */
export type Placement = {
  enrollment_id: number;
  name: string;
  class: number;
  /** none = class not promoted yet (next promotion places it); waiting = move with new_roll null. */
  action: 'none' | 'remove' | 'graduate' | 'unchanged' | 'move';
  new_class: number | null;
  new_section: string | null;
  new_roll: number | null;
};

export const fetchPlacement = async (
  year: number,
  enrollmentId: number,
  status: EnrollmentStatus,
) => {
  const response = await axios.get(`/api/promotions/${year}/results/${enrollmentId}/placement`, {
    params: { status },
  });
  return response.data?.data as Placement;
};

/** One line for confirm dialogs / toasts; null when nothing changes next year. */
export const placementText = (p: Placement, nextYear: number): string | null => {
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
};

export const useOverrideEnrollmentStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      year,
      enrollmentId,
      status,
    }: {
      year: number;
      enrollmentId: number;
      status: EnrollmentStatus;
    }) => {
      const response = await axios.patch(`/api/promotions/${year}/results/${enrollmentId}`, {
        status,
      });
      return response.data?.data as Placement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-stats'] });
    },
    onError: (error: any) => {
      fail('status', error, 'Could not update status');
    },
  });
};

/** Withhold (`hold`) or release (`release`) results for the given enrollments. */
export const useResultHold = (action: 'hold' | 'release') => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ year, enrollmentIds }: { year: number; enrollmentIds: number[] }) => {
      const path = action === 'hold' ? 'holds' : 'releases';
      const response = await axios.post(`/api/promotions/${year}/results/${path}`, {
        enrollment_ids: enrollmentIds,
      });
      return {
        year,
        ...(response.data?.data as {
          held?: number;
          removedNextYear?: number;
          batch?: number;
          updated?: number;
          placements?: Placement[];
        }),
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-stats'] });
      if (action === 'hold') {
        notify('hold', [
          'Result held — not ranked or promoted until released.',
          !!data.removedNextYear && `Their ${data.year + 1} class place was removed.`,
        ]);
        return;
      }
      const moves = (data.placements ?? [])
        .map((p) => placementText(p, data.year + 1))
        .filter((t): t is string => !!t);
      notify('hold', [
        `${plural(data.placements?.length || 1, 'result')} released (ranked after earlier results).`,
        ...moves.slice(0, 3),
        moves.length > 3 && `…and ${moves.length - 3} more placed at the end of their class.`,
      ]);
    },
    onError: (error: any) => {
      fail('hold', error, `Could not ${action} results`);
    },
  });
};

export const useUpdatePromotionStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (year: number) => {
      const response = await axios.post(`/api/promotions/${year}/results`);
      return response.data?.data as
        | {
            updated?: number;
            passed?: number;
            failed?: number;
            missingYearEnd?: number[];
            missingPrevious?: number[];
          }
        | undefined;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-stats'] });
      const noYearEnd = data?.missingYearEnd ?? [];
      const noPrevious = data?.missingPrevious ?? [];
      notify(
        'generate',
        [
          data?.passed != null && data?.failed != null
            ? `Pass/fail updated: ${data.passed} passed, ${data.failed} failed.`
            : 'Pass/fail generated.',
          noYearEnd.length > 0 &&
            `Class ${noYearEnd.join(', ')} not generated: no year-end exam (create it in Exam Setup).`,
          noPrevious.length > 0 &&
            `Class ${noPrevious.join(', ')} not generated: no exam before the year-end exam.`,
        ],
        noYearEnd.length || noPrevious.length ? 'warning' : 'success',
      );
    },
    onError: (error: any) => {
      fail('generate', error, 'Could not generate results');
    },
  });
};

export const usePromotionPreview = () => {
  return useMutation({
    mutationFn: async (year: number) => {
      const response = await axios.get(`/api/promotions/${year}/plan`);
      return response.data?.data as PromotionPreview;
    },
    onError: (error: any) => {
      fail('preview', error, 'Could not build promotion preview');
    },
  });
};

export const useGraduationPreview = () => {
  return useMutation({
    mutationFn: async (year: number) => {
      const response = await axios.get(`/api/graduations/${year}/plan`);
      return response.data?.data as GraduationPreview;
    },
    onError: (error: any) => {
      fail('preview', error, 'Could not build graduation preview');
    },
  });
};

export const useGraduateClass10 = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (year: number) => {
      const response = await axios.post(`/api/graduations/${year}`);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-stats'] });
      const p = data?.data as
        { graduated?: number; retained?: number; skipped?: number } | undefined;
      notify('graduate', [
        p?.graduated != null
          ? `Class 10 graduated: ${plural(p.graduated, 'alumnus', 'alumni')}, ${p.retained ?? 0} stay in class 10.`
          : 'Class 10 graduated.',
        !!p?.skipped &&
          `${plural(p.skipped, 'student')} left out on purpose (result held or not generated) — names are in the preview.`,
      ]);
    },
    onError: (error: any) => {
      fail('graduate', error, 'Could not graduate class 10');
    },
  });
};

export const useGeneratePromotionRoll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (year: number) => {
      const response = await axios.post(`/api/promotions/${year}`);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-stats'] });
      const payload = data?.data as
        | { promoted?: number; awaitingRoll?: number; skipped?: number; newYear?: number }
        | undefined;
      notify('promote', [
        payload?.promoted != null
          ? `Promoted: ${plural(payload.promoted, 'student')} placed in ${payload.newYear}.`
          : 'Promotion complete.',
        !!payload?.awaitingRoll &&
          `${plural(payload.awaitingRoll, 'failed class-6 student')} wait for a roll — import admissions, then Assign retained.`,
        !!payload?.skipped &&
          `${plural(payload.skipped, 'student')} left out on purpose (result held or not generated) — names are in the preview.`,
      ]);
    },
    onError: (error: any) => {
      fail('promote', error, 'Could not promote students');
    },
  });
};

export const useAssignRetained = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (year: number) => {
      const response = await axios.post(`/api/promotions/${year}/retained`);
      return response.data?.data as { assigned: number; newYear: number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-stats'] });
      notify('retained', [
        data.assigned
          ? `${plural(data.assigned, 'failed class-6 student')} numbered in ${data.newYear}, after the admitted students.`
          : 'Nobody is waiting for a roll.',
      ]);
    },
    onError: (error: any) => {
      fail('retained', error, 'Could not assign retained students');
    },
  });
};

export type CorrectionKey =
  'reset_promotion' | 'undo_graduation' | 'clear_manual' | 'reset_release_batches';

/** Dry run of "Correct mistakes": what each option would change; `with_marks` > 0 blocks it. */
export type CorrectionsPreview = {
  year: number;
  newYear: number;
  reset_promotion: { available: boolean; rows: number; with_marks: number };
  undo_graduation: { available: boolean; graduated: number; rows: number; with_marks: number };
  clear_manual: { available: boolean; students: number };
  reset_release_batches: { available: boolean; students: number };
};

export const useCorrectionsPreview = (year: number, enabled: boolean) =>
  useQuery({
    queryKey: ['promotion-corrections', year],
    enabled,
    queryFn: async () => {
      const response = await axios.get(`/api/promotions/${year}/corrections/plan`);
      return response.data?.data as CorrectionsPreview;
    },
  });

export const useApplyCorrections = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      year,
      options,
    }: {
      year: number;
      options: Partial<Record<CorrectionKey, boolean>>;
    }) => {
      const response = await axios.post(`/api/promotions/${year}/corrections`, options);
      return response.data?.data as {
        newYear: number;
        promotion_rows_removed: number;
        graduation_undone: number;
        graduation_rows_removed: number;
        manual_cleared: number;
        batches_reset: number;
        regenerated: boolean;
        placements: Placement[];
      };
    },
    onSuccess: (r, { options }) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-stats'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-corrections'] });
      notify('corrections', [
        'Corrections applied.',
        options.reset_promotion &&
          `Promotion reset: ${plural(r.promotion_rows_removed, 'next-year place')} removed. Run Review & promote when ready.`,
        options.undo_graduation &&
          `Graduation undone: ${plural(r.graduation_undone, 'student')} active again, ${plural(r.graduation_rows_removed, 'class-10 place')} removed.`,
        options.clear_manual && `${plural(r.manual_cleared, 'manual pass/fail')} cleared.`,
        options.reset_release_batches &&
          `${plural(r.batches_reset, 'late result')} now rank by marks.`,
        r.regenerated && 'Pass/fail and positions recalculated from marks.',
        r.placements.length > 0 &&
          `${plural(r.placements.length, 'student')} moved next year because the result changed.`,
      ]);
    },
    onError: (error: any) => fail('corrections', error, 'Could not apply corrections'),
  });
};

/** "Use calculated result" for one student. */
export const useClearOverride = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ year, enrollmentId }: { year: number; enrollmentId: number }) => {
      const response = await axios.delete(
        `/api/promotions/${year}/results/${enrollmentId}/override`,
      );
      return { year, ...(response.data?.data as Placement & { status: string }) };
    },
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-stats'] });
      notify('status', [
        `${p.name}: calculated result is ${p.status}.`,
        placementText(p, p.year + 1),
      ]);
    },
    onError: (error: any) => fail('status', error, 'Could not clear the manual result'),
  });
};
