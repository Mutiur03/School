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

// Whole-class exam bundle (one PDF for class+exam).
export type BundleJob = {
  kind: "bundle";
  examId: number;
  examName: string;
  year: number;
  class: number;
  schoolId: number;
};

export type MarksheetJob = StudentJob | BundleJob;

// Individual student marksheet pre-generation. Separate queue from the
// admission pdfQueue so the two don't contend for the same workers.
export const marksheetQueue = new Bull<MarksheetJob>("marksheetQueue", {
  redis: { host, port: 6379 },
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

export const jobId = (examId: number, studentId: number) =>
  `ms:${examId}:${studentId}`;

export const bundleJobId = (examId: number, cls: number) =>
  `msb:${examId}:${cls}`;
