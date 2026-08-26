import logger from '@/utils/logger.js';
import { drainBullQueue, startBullWorker } from '@/utils/bullWorker.js';
import { marksheetQueue } from './marksheet.queue.js';
import { MarksheetService } from './marksheet.service.js';

const parsed = Number(process.env.MARKSHEET_WORKER_CONCURRENCY);
const CONCURRENCY = Math.max(1, Number.isFinite(parsed) && parsed > 0 ? parsed : 1);
const DRAIN_TIMEOUT_MS = Number(process.env.MARKSHEET_DRAIN_TIMEOUT_MS || String(3 * 60 * 1000));

let started = false;

export function startMarksheetWorker(): void {
  if (started) return;
  started = true;

  startBullWorker({
    queue: marksheetQueue,
    name: 'marksheet',
    concurrency: CONCURRENCY,
    process: async (job) => {
      const d: any = job.data;
      logger.debug('[marksheet] worker: picked up job', {
        jobId: job.id,
        kind: d?.kind ?? 'student',
        examId: d?.examId,
        target:
          d?.kind === 'bundle'
            ? `class-${d?.class}:${d?.bundleSection ?? 'ALL'}`
            : d?.kind === 'session-student'
              ? `session-${d?.studentId}`
              : d?.kind === 'session-year'
                ? `session-year-${d?.year}`
                : d?.studentId,
      });
      await MarksheetService.processJob(job.data);
    },
    onStarted: () => {
      MarksheetService.recover()
        .then(() => MarksheetService.applyDesignVersionBumpIfNeeded())
        .catch((e) =>
          logger.warn('Marksheet recovery / design bump failed', {
            error: e instanceof Error ? e.message : String(e),
          }),
        );
    },
  });
}

export async function drainMarksheetQueue(timeoutMs: number = DRAIN_TIMEOUT_MS): Promise<void> {
  return drainBullQueue(marksheetQueue, 'marksheet', timeoutMs);
}
