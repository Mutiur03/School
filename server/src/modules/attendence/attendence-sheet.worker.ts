import logger from '@/utils/logger.js';
import { drainBullQueue, startBullWorker } from '@/utils/bullWorker.js';
import { attendanceSheetQueue } from './attendence-sheet.queue.js';
import { AttendanceSheetService } from './attendence-sheet.service.js';

const parsed = Number(process.env.ATTENDANCE_SHEET_WORKER_CONCURRENCY);
const CONCURRENCY = Math.max(1, Number.isFinite(parsed) && parsed > 0 ? parsed : 1);
const DRAIN_TIMEOUT_MS = Number(
  process.env.ATTENDANCE_SHEET_DRAIN_TIMEOUT_MS || String(3 * 60 * 1000),
);

let started = false;

export function startAttendanceSheetWorker(): void {
  if (started) return;
  started = true;

  startBullWorker({
    queue: attendanceSheetQueue,
    name: 'attendance-sheet',
    concurrency: CONCURRENCY,
    process: async (job) => {
      const d = job.data;
      logger.debug('[attendance-sheet] worker: picked up job', {
        jobId: job.id,
        year: d?.year,
        month: d?.month,
        class: d?.class,
        section: d?.section,
      });
      await AttendanceSheetService.processJob(job.data);
    },
    onStarted: () => {
      AttendanceSheetService.recover()
        .then(() => AttendanceSheetService.enqueueMissingHistorySheets())
        .then(() => AttendanceSheetService.pinEndedMonthSnapshots())
        .then(() => AttendanceSheetService.applyDesignVersionBumpIfNeeded())
        .catch((e) =>
          logger.warn('Attendance sheet recovery / history backfill failed', {
            error: e instanceof Error ? e.message : String(e),
          }),
        );
    },
  });
}

export async function drainAttendanceSheetQueue(
  timeoutMs: number = DRAIN_TIMEOUT_MS,
): Promise<void> {
  return drainBullQueue(attendanceSheetQueue, 'attendance-sheet', timeoutMs);
}
