import type Bull from 'bull';

export const PRIORITY_USER = 1;
export const PRIORITY_BACKFILL = 2;

export const defaultJobOpts = (priority: number): Bull.JobOptions => ({
  priority,
  attempts: 3,
  backoff: { type: 'fixed', delay: 5000 },
  removeOnComplete: true,
  removeOnFail: 200,
});

/** Enqueue (or promote) a job at user priority. Active jobs are left alone. */
export async function enqueueUserPriority<T>(
  queue: Bull.Queue<T>,
  data: T,
  id: string,
): Promise<void> {
  const opts = { jobId: id, ...defaultJobOpts(PRIORITY_USER) };
  const existing = await queue.getJob(id);

  if (!existing) {
    await queue.add(data, opts);
    return;
  }

  const state = await existing.getState();
  if (state === 'active') return;

  const currentPriority = existing.opts?.priority ?? PRIORITY_BACKFILL;
  if (state === 'failed' || state === 'completed' || currentPriority > PRIORITY_USER) {
    try {
      await existing.remove();
    } catch {
      return;
    }
    await queue.add(data, opts);
  }
}

/** Ensure a backfill job exists. Returns true when a new job was added. */
export async function ensureJobQueued<T>(
  queue: Bull.Queue<T>,
  data: T,
  id: string,
  priority: number = PRIORITY_BACKFILL,
): Promise<boolean> {
  const opts = { jobId: id, ...defaultJobOpts(priority) };
  const existing = await queue.getJob(id);

  if (!existing) {
    await queue.add(data, opts);
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
  await queue.add(data, opts);
  return true;
}
