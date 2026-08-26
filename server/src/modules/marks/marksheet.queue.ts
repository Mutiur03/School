import Bull from 'bull';
import {
  PRIORITY_BACKFILL,
  PRIORITY_USER,
  defaultJobOpts,
  enqueueUserPriority as enqueueUserPriorityShared,
  ensureJobQueued as ensureJobQueuedShared,
} from '@/utils/bullQueue.js';

const host = process.env.REDIS_HOST || '127.0.0.1';

// Per-student marksheet. `kind` is optional for backward compatibility with
// jobs enqueued before bundles existed (absent kind => student).
export type StudentJob = {
  kind?: 'student';
  studentId: number;
  examId: number;
  examName: string;
  year: number;
  schoolId: number;
};

export type BundleJob = {
  kind: 'bundle';
  examId: number;
  examName: string;
  year: number;
  class: number;
  schoolId: number;
  /** "ALL" for admin whole class; single section or "A+B" for teacher scope. */
  bundleSection?: string;
};

export type SessionStudentJob = {
  kind: 'session-student';
  studentId: number;
  year: number;
  schoolId: number;
};

export type SessionYearJob = {
  kind: 'session-year';
  year: number;
  schoolId: number;
};

export type MarksheetJob = StudentJob | BundleJob | SessionStudentJob | SessionYearJob;

export const marksheetQueue = new Bull<MarksheetJob>('marksheetQueue', {
  redis: { host, port: 6379 },
  settings: {
    lockDuration: 5 * 60 * 1000,
    stalledInterval: 60 * 1000,
    maxStalledCount: 2,
  },
});

export { PRIORITY_USER, PRIORITY_BACKFILL, defaultJobOpts };

export async function enqueueUserPriority(data: MarksheetJob, id: string): Promise<void> {
  return enqueueUserPriorityShared(marksheetQueue, data, id);
}

export async function ensureJobQueued(
  data: MarksheetJob,
  id: string,
  priority: number = PRIORITY_BACKFILL,
): Promise<boolean> {
  return ensureJobQueuedShared(marksheetQueue, data, id, priority);
}

/**
 * Re-queue after the current handler finishes. Same jobId cannot be added while
 * the job is still `active`; retries briefly so a completed/failed orphan or a
 * race with Bull's completion bookkeeping does not leave the DB row pending.
 */
export async function ensureJobQueuedAfterDefer(
  data: MarksheetJob,
  id: string,
  priority: number = PRIORITY_BACKFILL,
  attempts = 5,
  delayMs = 100,
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      await new Promise((r) => setTimeout(r, delayMs * i));
    }
    try {
      const existing = await marksheetQueue.getJob(id);
      if (existing) {
        const state = await existing.getState();
        if (state === 'active') continue;
        if (state === 'waiting' || state === 'delayed') return true;
      }
      const added = await ensureJobQueued(data, id, priority);
      if (added) return true;
    } catch {
      // Retry — Redis/Bull races during job completion are transient.
    }
  }
  return false;
}

export const jobId = (schoolId: number, examId: number, studentId: number) =>
  `ms:${schoolId}:${examId}:${studentId}`;

export const bundleJobId = (schoolId: number, examId: number, cls: number, bundleSection = 'ALL') =>
  `msb:${schoolId}:${examId}:${cls}:${bundleSection}`;

export const sessionStudentJobId = (schoolId: number, year: number, studentId: number) =>
  `mss:${schoolId}:${year}:${studentId}`;

export const sessionYearJobId = (schoolId: number, year: number) => `msy:${schoolId}:${year}`;
