import Bull from 'bull';
import {
  PRIORITY_BACKFILL,
  PRIORITY_USER,
  defaultJobOpts,
  enqueueUserPriority as enqueueUserPriorityShared,
  ensureJobQueued as ensureJobQueuedShared,
} from '@/utils/bullQueue.js';

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

export { PRIORITY_USER, PRIORITY_BACKFILL, defaultJobOpts };

export const attendanceSheetJobId = (
  schoolId: number,
  year: number,
  month: number,
  cls: number,
  section: string,
) => `att:${schoolId}:${year}:${month}:${cls}:${section}`;

export async function enqueueUserPriority(data: AttendanceSheetJob, id: string): Promise<void> {
  return enqueueUserPriorityShared(attendanceSheetQueue, data, id);
}

export async function ensureJobQueued(
  data: AttendanceSheetJob,
  id: string,
  priority: number = PRIORITY_BACKFILL,
): Promise<boolean> {
  return ensureJobQueuedShared(attendanceSheetQueue, data, id, priority);
}
