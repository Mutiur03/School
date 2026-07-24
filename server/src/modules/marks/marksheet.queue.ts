import Bull from "bull";

const host = process.env.REDIS_HOST || "127.0.0.1";

// Per-student marksheet. `kind` is optional for backward compatibility with
// jobs enqueued before bundles existed (absent kind => student).
export type StudentJob = {
  kind?: "student";
  studentId: number;
  examId: number;
  examName: string;
  year: number;
  schoolId: number;
};

// Whole-class or section-scoped exam bundle (one PDF for class+exam).
export type BundleJob = {
  kind: "bundle";
  examId: number;
  examName: string;
  year: number;
  class: number;
  schoolId: number;
  /** "ALL" for admin whole class; single section or "A+B" for teacher scope. */
  bundleSection?: string;
};

export type SessionStudentJob = {
  kind: "session-student";
  studentId: number;
  year: number;
  schoolId: number;
};

export type SessionYearJob = {
  kind: "session-year";
  year: number;
  schoolId: number;
};

export type MarksheetJob =
  | StudentJob
  | BundleJob
  | SessionStudentJob
  | SessionYearJob;

// Individual student marksheet pre-generation. Separate queue so PDF work
// does not contend with other Bull queues on the same Redis.
// PDF render can exceed Bull's default 30s lock; without a longer lock the
// job is marked stalled and fails with "job stalled more than allowable limit"
// even though the worker is still working.
export const marksheetQueue = new Bull<MarksheetJob>("marksheetQueue", {
  redis: { host, port: 6379 },
  settings: {
    lockDuration: 5 * 60 * 1000, // 5 min — cover slow PDF + R2 upload
    stalledInterval: 60 * 1000,
    maxStalledCount: 2,
  },
});

// Lower priority value = processed first. User-triggered warmups jump ahead of
// bulk publish backfill.
export const PRIORITY_USER = 1;
export const PRIORITY_BACKFILL = 2;

export const defaultJobOpts = (priority: number): Bull.JobOptions => ({
  priority,
  attempts: 3,
  backoff: { type: "fixed", delay: 5000 },
  removeOnComplete: true,
  removeOnFail: 200,
});

/**
 * Enqueue (or promote) a job at user priority. If the same jobId is already
 * waiting as backfill, remove + re-add so it jumps ahead of the bulk queue.
 * Active jobs are left alone (almost done).
 */
export async function enqueueUserPriority(
  data: MarksheetJob,
  id: string,
): Promise<void> {
  const opts = { jobId: id, ...defaultJobOpts(PRIORITY_USER) };
  const existing = await marksheetQueue.getJob(id);

  if (!existing) {
    await marksheetQueue.add(data, opts);
    return;
  }

  const state = await existing.getState();
  if (state === "active" || state === "completed") {
    return;
  }

  const currentPriority = existing.opts?.priority ?? PRIORITY_BACKFILL;
  if (state === "failed" || currentPriority > PRIORITY_USER) {
    try {
      await existing.remove();
    } catch {
      // Race: job became active between getState and remove — leave it.
      return;
    }
    await marksheetQueue.add(data, opts);
    return;
  }

  // Already waiting at user priority (or better).
}

/**
 * Ensure a backfill job exists in Redis for a DB `pending` row.
 * Handles lost/stalled jobs: failed/completed orphans are removed and re-added.
 * Returns true when a new job was added.
 */
export async function ensureJobQueued(
  data: MarksheetJob,
  id: string,
  priority: number = PRIORITY_BACKFILL,
): Promise<boolean> {
  const opts = { jobId: id, ...defaultJobOpts(priority) };
  const existing = await marksheetQueue.getJob(id);

  if (!existing) {
    await marksheetQueue.add(data, opts);
    return true;
  }

  const state = await existing.getState();
  if (state === "active" || state === "waiting" || state === "delayed") {
    return false;
  }

  try {
    await existing.remove();
  } catch {
    return false;
  }
  await marksheetQueue.add(data, opts);
  return true;
}

export const jobId = (examId: number, studentId: number) =>
  `ms:${examId}:${studentId}`;

export const bundleJobId = (
  examId: number,
  cls: number,
  bundleSection = "ALL",
) => `msb:${examId}:${cls}:${bundleSection}`;

export const sessionStudentJobId = (year: number, studentId: number) =>
  `mss:${year}:${studentId}`;

export const sessionYearJobId = (year: number) => `msy:${year}`;
