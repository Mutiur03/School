import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import logger from '@/utils/logger.js';
import { drainBullQueue, startBullWorker } from '@/utils/bullWorker.js';
import { MarksheetJobsService } from './marksheet-jobs.service.js';
import { MARKSHEET_QUEUE } from './marksheet.queue.js';
import type { MarksheetQueue } from './marksheet.queue.js';

const parsed = Number(process.env.MARKSHEET_WORKER_CONCURRENCY);
const CONCURRENCY = Math.max(1, Number.isFinite(parsed) && parsed > 0 ? parsed : 1);
const DRAIN_TIMEOUT_MS = Number(process.env.MARKSHEET_DRAIN_TIMEOUT_MS || String(3 * 60 * 1000));

/** Bull consumer for marksheet jobs. Not auto-started: server.ts calls start() after listen (specs boot the app without it). */
@Injectable()
export class MarksheetWorker implements OnModuleDestroy {
  private started = false;

  constructor(
    @Inject(MARKSHEET_QUEUE) private readonly queue: MarksheetQueue,
    private readonly jobs: MarksheetJobsService,
  ) {}

  start(): void {
    if (this.started) return;
    this.started = true;

    startBullWorker({
      queue: this.queue,
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
        await this.jobs.processJob(job.data);
      },
      onStarted: () => {
        this.jobs
          .recover()
          .then(() => this.jobs.applyDesignVersionBumpIfNeeded())
          .catch((e) =>
            logger.warn('Marksheet recovery / design bump failed', {
              error: e instanceof Error ? e.message : String(e),
            }),
          );
      },
    });
  }

  /** Pause local processing and wait for in-flight jobs (graceful shutdown). */
  drain(timeoutMs: number = DRAIN_TIMEOUT_MS): Promise<void> {
    return drainBullQueue(this.queue, 'marksheet', timeoutMs);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.started) await this.drain();
  }
}
