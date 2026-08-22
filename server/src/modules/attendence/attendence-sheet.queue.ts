import Bull from 'bull';

const host = process.env.REDIS_HOST || '127.0.0.1';

export type AttendanceSheetJob = {
  schoolId: number;
  year: number;
  month: number; // 1–12
  class: number;
  section: string;
};

export const attendanceSheetQueue = new Bull<AttendanceSheetJob>('attendanceSheetQueue', {
  redis: { host, port: 6379 },
  settings: {
    lockDuration: 5 * 60 * 1000,
    stalledInterval: 60 * 1000,
    maxStalledCount: 2,
  },
});

export const PRIORITY_USER = 1;
export const PRIORITY_BACKFILL = 2;

export const defaultJobOpts = (priority: number): Bull.JobOptions => ({
  priority,
  attempts: 3,
  backoff: { type: 'fixed', delay: 5000 },
  removeOnComplete: true,
  removeOnFail: 200,
});

export const attendanceSheetJobId = (
  schoolId: number,
  year: number,
  month: number,
  cls: number,
  section: string,
) => `att:${schoolId}:${year}:${month}:${cls}:${section}`;

/**
 * Enqueue (or promote) a job at user priority. If the same jobId is already
 * waiting as backfill, remove + re-add so it jumps ahead of the bulk queue.
 */
export async function enqueueUserPriority(data: AttendanceSheetJob, id: string): Promise<void> {
  const opts = { jobId: id, ...defaultJobOpts(PRIORITY_USER) };
  const existing = await attendanceSheetQueue.getJob(id);

  if (!existing) {
    await attendanceSheetQueue.add(data, opts);
    return;
  }

  const state = await existing.getState();
  // Active = almost done; leave it. Completed orphans must be re-added or
  // download polls forever with a stale cache and no new job.
  if (state === 'active') {
    return;
  }

  const currentPriority = existing.opts?.priority ?? PRIORITY_BACKFILL;
  if (state === 'failed' || state === 'completed' || currentPriority > PRIORITY_USER) {
    try {
      await existing.remove();
    } catch {
      return;
    }
    await attendanceSheetQueue.add(data, opts);
    return;
  }
}

/**
 * Ensure a backfill job exists. Returns true when a new job was added.
 */
export async function ensureJobQueued(
  data: AttendanceSheetJob,
  id: string,
  priority: number = PRIORITY_BACKFILL,
): Promise<boolean> {
  const opts = { jobId: id, ...defaultJobOpts(priority) };
  const existing = await attendanceSheetQueue.getJob(id);

  if (!existing) {
    await attendanceSheetQueue.add(data, opts);
    return true;
  }

  const state = await existing.getState();
  if (state === 'active' || state === 'waiting' || state === 'delayed') {
    return false;
  }

  try {
    await existing.remove();
  } catch {
    return false;
  }
  await attendanceSheetQueue.add(data, opts);
  return true;
}
