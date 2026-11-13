import type Bull from 'bull';
import logger from '@/utils/logger.js';

const DRAIN_POLL_MS = 2000;

/**
 * Resume queue, register processor, wire failed/drained logs.
 * `onStarted` runs once after the worker is registered (recovery hooks, etc.).
 */
export function startBullWorker<T>(opts: {
  queue: Bull.Queue<T>;
  name: string;
  concurrency: number;
  process: (job: Bull.Job<T>) => Promise<unknown>;
  onStarted?: () => void;
}): void {
  const { queue, name } = opts;

  queue.resume().catch((e) =>
    logger.warn(`[${name}] worker: resume failed`, {
      error: e instanceof Error ? e.message : String(e),
    }),
  );

  // Before taking work, release jobs a killed process left `active` (its lock lives on for
  // lockDuration, blocking re-queues of that jobId). Then register the processor.
  void releaseOrphanedActiveJobs(queue, name).finally(() =>
    queue.process(opts.concurrency, async (job) => {
      await opts.process(job);
      return true;
    }),
  );

  queue.on('failed', (job, err) => {
    logger.warn(`[${name}] worker: job failed (Bull)`, {
      jobId: job?.id,
      data: job?.data,
      attempts: job?.attemptsMade,
      error: err?.message,
    });
  });

  queue.on('drained', async () => {
    try {
      const counts = await queue.getJobCounts();
      logger.info(`[${name}] worker: queue drained`, counts);
    } catch {
      logger.info(`[${name}] worker: queue drained`);
    }
  });

  logger.info(`[${name}] worker: started`, { concurrency: opts.concurrency });
  opts.onStarted?.();
}

/**
 * Move every `active` job back to wait by dropping its lock. Runs before this process
 * registers its processor, so nothing here is ours.
 * ponytail: assumes one worker process per queue. With several, a peer's live job may be
 * re-run; the DB claim (pending/failed → generating) makes that a no-op skip.
 */
export async function releaseOrphanedActiveJobs(queue: Bull.Queue, name: string): Promise<void> {
  try {
    const active = await queue.getActive();
    if (active.length === 0) return;
    await queue.client.del(...active.map((j) => `${queue.toKey(String(j.id))}:lock`));
    await (queue as any).moveUnlockedJobsToWait();
    logger.info(`[${name}] worker: released orphaned active jobs`, {
      jobIds: active.map((j) => j.id),
    });
  } catch (e) {
    logger.warn(`[${name}] worker: releasing orphaned active jobs failed`, {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/** Pause local processing and wait for in-flight jobs before shutdown. */
export async function drainBullQueue(
  queue: Bull.Queue,
  name: string,
  timeoutMs: number,
): Promise<void> {
  try {
    await queue.pause(true);
  } catch (e) {
    logger.warn(`[${name}] drain: pause failed`, {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let active = 0;
    try {
      active = await queue.getActiveCount();
    } catch (e) {
      logger.warn(`[${name}] drain: getActiveCount failed`, {
        error: e instanceof Error ? e.message : String(e),
      });
      break;
    }
    if (active === 0) {
      logger.info(`[${name}] drain: no active jobs`);
      return;
    }
    logger.info(`[${name}] drain: waiting for active jobs`, {
      active,
      remainingMs: Math.max(0, deadline - Date.now()),
    });
    await new Promise((r) => setTimeout(r, DRAIN_POLL_MS));
  }

  const leftover = await queue.getActiveCount().catch(() => -1);
  logger.warn(`[${name}] drain: timeout with jobs still active`, {
    active: leftover,
    timeoutMs,
  });
}
