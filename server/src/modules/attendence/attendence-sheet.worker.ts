import logger from '@/utils/logger.js';
import { attendanceSheetQueue } from './attendence-sheet.queue.js';
import { AttendanceSheetService } from './attendence-sheet.service.js';

const parsed = Number(process.env.ATTENDANCE_SHEET_WORKER_CONCURRENCY);
const CONCURRENCY = Math.max(1, Number.isFinite(parsed) && parsed > 0 ? parsed : 1);

const DRAIN_TIMEOUT_MS = Number(
  process.env.ATTENDANCE_SHEET_DRAIN_TIMEOUT_MS || String(3 * 60 * 1000),
);
const DRAIN_POLL_MS = 2000;

let started = false;

/** Register the in-process attendance-sheet worker. Call once at server startup. */
export function startAttendanceSheetWorker(): void {
  if (started) return;
  started = true;

  // Drain pauses the queue in Redis; that pause survives restarts. Always
  // resume on boot or download will hang forever waiting for jobs that never run.
  attendanceSheetQueue.resume().catch((e) =>
    logger.warn('[attendance-sheet] worker: resume failed', {
      error: e instanceof Error ? e.message : String(e),
    }),
  );

  attendanceSheetQueue.process(CONCURRENCY, async (job) => {
    const d = job.data;
    logger.debug('[attendance-sheet] worker: picked up job', {
      jobId: job.id,
      year: d?.year,
      month: d?.month,
      class: d?.class,
      section: d?.section,
    });
    await AttendanceSheetService.processJob(job.data);
    return true;
  });

  attendanceSheetQueue.on('failed', (job, err) => {
    logger.warn('[attendance-sheet] worker: job failed (Bull)', {
      jobId: job?.id,
      data: job?.data,
      attempts: job?.attemptsMade,
      error: err?.message,
    });
  });

  attendanceSheetQueue.on('drained', async () => {
    try {
      const counts = await attendanceSheetQueue.getJobCounts();
      logger.info('[attendance-sheet] worker: queue drained', counts);
    } catch {
      logger.info('[attendance-sheet] worker: queue drained');
    }
  });

  logger.info('[attendance-sheet] worker: started', { concurrency: CONCURRENCY });

  // Recover stuck jobs → fill missing history (all years) → pin ended-month
  // teachers → design-bump open months only.
  AttendanceSheetService.recover()
    .then(() => AttendanceSheetService.enqueueMissingHistorySheets())
    .then(() => AttendanceSheetService.pinEndedMonthSnapshots())
    .then(() => AttendanceSheetService.applyDesignVersionBumpIfNeeded())
    .catch((e) =>
      logger.warn('Attendance sheet recovery / history backfill failed', {
        error: e instanceof Error ? e.message : String(e),
      }),
    );
}

/**
 * Pause local processing and wait for in-flight attendance-sheet jobs to finish.
 */
export async function drainAttendanceSheetQueue(
  timeoutMs: number = DRAIN_TIMEOUT_MS,
): Promise<void> {
  try {
    await attendanceSheetQueue.pause(true);
  } catch (e) {
    logger.warn('[attendance-sheet] drain: pause failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let active = 0;
    try {
      active = await attendanceSheetQueue.getActiveCount();
    } catch (e) {
      logger.warn('[attendance-sheet] drain: getActiveCount failed', {
        error: e instanceof Error ? e.message : String(e),
      });
      break;
    }
    if (active === 0) {
      logger.info('[attendance-sheet] drain: no active jobs');
      return;
    }
    logger.info('[attendance-sheet] drain: waiting for active jobs', {
      active,
      remainingMs: Math.max(0, deadline - Date.now()),
    });
    await new Promise((r) => setTimeout(r, DRAIN_POLL_MS));
  }

  const leftover = await attendanceSheetQueue.getActiveCount().catch(() => -1);
  logger.warn('[attendance-sheet] drain: timeout with jobs still active', {
    active: leftover,
    timeoutMs,
  });
}
