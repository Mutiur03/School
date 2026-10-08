import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@/generated/prisma/client.js';
import { getFileBuffer, headObject, uploadToR2 } from '@/config/r2.js';
import { runWithRlsContext } from '@/config/rlsContextStore.js';
import { isExamFrozen } from '@/modules/exam/exam-year-end.js';
import logger from '@/utils/logger.js';
import {
  PRIORITY_BACKFILL,
  PRIORITY_USER,
  defaultJobOpts,
  enqueueUserPriority,
  ensureJobQueued,
} from '@/utils/bullQueue.js';
import { PRISMA } from '../../../common/prisma.module.js';
import type { AccessUser } from '../access.js';
import {
  MARKSHEET_DESIGN_VERSION,
  SESSION_YEAR_STUDENT_ID,
  bundleSectionKey,
  enrollmentWhereForBundleSection,
  marksheetBundleWhere,
  marksheetSessionWhere,
  marksheetStudentWhere,
  parseSignatoryDetail,
} from '../cache/marksheet-cache.helpers.js';
import { MarksheetCacheService } from '../cache/marksheet-cache.service.js';
import { MarksheetHashService } from '../cache/marksheet-hash.service.js';
import { MarksheetRenderer } from '../pdf/marksheet-renderer.js';
import { mergeMarksheetPdfs } from './marksheet-bundle-merge.js';
import {
  MARKSHEET_QUEUE,
  bundleJobId,
  ensureJobQueuedAfterDefer,
  jobId,
  sessionStudentJobId,
  sessionYearJobId,
} from './marksheet.queue.js';
import type {
  BundleJob,
  MarksheetJob,
  MarksheetQueue,
  SessionStudentJob,
  SessionYearJob,
  StudentJob,
} from './marksheet.queue.js';

// The worker has no HTTP user; every query is school-scoped, so an admin-role
// synthetic user only satisfies the in-code access check.
const WORKER_USER: AccessUser = { id: 0, role: 'admin' };

/**
 * Bundle assemble aborts for a class with nothing to merge — no enrollments, or
 * enrollments but not a single non-null mark. Neither is a failure: there is
 * simply no bundle to produce, so the row is terminal (`skipped`) rather than
 * retried forever.
 */
const EMPTY_BUNDLE_MESSAGES = ['No students found', 'No non-null marks found'];

const isEmptyBundleError = (message: string) =>
  EMPTY_BUNDLE_MESSAGES.some((m) => message.includes(m));

/**
 * Consecutive automatic retries allowed for a failed bundle before the poll
 * driven re-queue gives up. Reset on an explicit download and on success, so
 * only an unattended failure loop is capped.
 */
const MAX_BUNDLE_ATTEMPTS = 5;

/** Throttle gap-fill on generation-status polls (avoids heavy DB work every few seconds). */
const ENSURE_QUEUED_COOLDOWN_MS = 30_000;

/** Fields of the RLS context the worker sets for tenant queries outside a request. */
const workerRls = (schoolId: number) => ({
  schoolId,
  isSuperAdmin: false,
  inRlsTransaction: false,
});

const r2Key = (schoolId: number, year: number, examId: number, studentId: number) =>
  `${schoolId}/marksheets/${year}/${examId}/${studentId}.pdf`;

const r2BundleKey = (
  schoolId: number,
  year: number,
  examId: number,
  cls: number,
  bundleSection: string,
) => {
  const sectionPart =
    bundleSection === 'ALL' ? 'all' : encodeURIComponent(bundleSection).replace(/%/g, '_');
  return `${schoolId}/marksheets/${year}/bundles/${examId}/class-${cls}-${sectionPart}.pdf`;
};

const r2SessionStudentKey = (schoolId: number, year: number, studentId: number) =>
  `${schoolId}/marksheets/${year}/session/student-${studentId}.pdf`;

const r2SessionYearKey = (schoolId: number, year: number) =>
  `${schoolId}/marksheets/${year}/session/all.pdf`;

/**
 * Copy a live signature into an exam-scoped R2 key so frozen sheets keep the
 * bytes that were current at generate time.
 */
async function freezeSignatoryAsset(
  schoolId: number,
  examId: number,
  personKey: string,
  sourcePath: string | null | undefined,
): Promise<string | null> {
  if (!sourcePath) return null;
  const prefix = `${schoolId}/marksheets/${examId}/signatories/`;
  if (sourcePath.startsWith(prefix)) return sourcePath;
  const buf = await getFileBuffer(sourcePath);
  if (!buf) return sourcePath;
  const dot = sourcePath.lastIndexOf('.');
  const ext = dot >= 0 && dot > sourcePath.lastIndexOf('/') ? sourcePath.slice(dot) : '.png';
  const dest = `${prefix}${personKey}${ext}`;
  const contentType =
    ext.toLowerCase() === '.jpg' || ext.toLowerCase() === '.jpeg'
      ? 'image/jpeg'
      : ext.toLowerCase() === '.webp'
        ? 'image/webp'
        : 'image/png';
  await uploadToR2(dest, buf, contentType);
  return dest;
}

/** Build frozen name/signature/phone detail from live teacher rows. */
async function captureStudentSignatoryDetail(
  schoolId: number,
  examId: number,
  head: { id: number | null; name: string | null; signature: string | null } | null,
  teacher: {
    id: number | null;
    name: string | null;
    signature: string | null;
    phone: string | null;
  } | null,
) {
  return {
    head:
      head && head.id != null
        ? {
            name: head.name,
            signature: await freezeSignatoryAsset(
              schoolId,
              examId,
              `head-${head.id}`,
              head.signature,
            ),
          }
        : null,
    teacher:
      teacher && teacher.id != null
        ? {
            name: teacher.name,
            signature: await freezeSignatoryAsset(
              schoolId,
              examId,
              `teacher-${teacher.id}`,
              teacher.signature,
            ),
            phone: teacher.phone,
          }
        : null,
  };
}

/** Queue side of the marksheet cache: enqueueing, the worker's job processors, recovery and status. */
@Injectable()
export class MarksheetJobsService {
  private readonly ensureQueuedLastRun = new Map<number, number>();

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(MARKSHEET_QUEUE) private readonly queue: MarksheetQueue,
    private readonly hash: MarksheetHashService,
    private readonly cache: MarksheetCacheService,
    private readonly renderer: MarksheetRenderer,
  ) {}

  /**
   * Queue pre-generation for every student with marks in an exam. Called on
   * result publish. Idempotent: re-running just re-marks rows pending and
   * re-enqueues (jobId dedups in-flight jobs).
   */
  async enqueueForExam(
    schoolId: number,
    examId: number,
    examName: string,
  ): Promise<{ queued: number }> {
    const marks = await this.prisma.marks.findMany({
      // Only students with at least one real mark — an enrollment with only
      // null marks would make the renderer throw "No marks found".
      where: { school_id: schoolId, exam_id: examId, marks: { not: null } },
      distinct: ['enrollment_id'],
      select: { enrollment: { select: { student_id: true, year: true } } },
    });

    const targets = new Map<number, number>(); // studentId -> year
    for (const m of marks) {
      const sid = m.enrollment?.student_id;
      const yr = m.enrollment?.year;
      if (sid != null && yr != null) targets.set(sid, yr);
    }

    if (targets.size === 0) {
      logger.info('[marksheet] enqueue(exam): no students with marks', { examId });
      return { queued: 0 };
    }

    const studentIds = [...targets.keys()];

    // Reset any rows that already exist (mirrors the upsert `update` branch)…
    await this.prisma.marksheet_files.updateMany({
      where: { school_id: schoolId, exam_id: examId, student_id: { in: studentIds } },
      data: { status: 'pending', error: null, exam_name: examName },
    });
    // …then create the ones that don't (mirrors the upsert `create` branch).
    await this.prisma.marksheet_files.createMany({
      data: [...targets].map(([studentId, yr]) => ({
        student_id: studentId,
        exam_id: examId,
        exam_name: examName,
        year: yr,
        school_id: schoolId,
        status: 'pending',
      })),
      skipDuplicates: true,
    });

    const jobs = [...targets].map(([studentId, yr]) => ({
      data: { studentId, examId, examName, year: yr, schoolId },
      opts: { jobId: jobId(schoolId, examId, studentId), ...defaultJobOpts(PRIORITY_BACKFILL) },
    }));

    await this.queue.addBulk(jobs);
    logger.info('[marksheet] enqueue(exam): queued student jobs', { examId, count: jobs.length });
    return { queued: jobs.length };
  }

  /**
   * If students have marks but no cache row (or only failed), queue generation.
   * Also re-queues pending/failed class bundles whose Bull jobs were lost
   * (stall, restart, jobId orphan). Called when the progress UI polls
   * generation-status so an empty DB still starts the worker without requiring
   * a re-publish.
   *
   * Heavy gap-fill (invalidate missing rows) is throttled. Lightweight orphan
   * re-attach for DB `pending`/`failed` rows runs on every poll so a lost Bull
   * job cannot sit pending for the full cooldown with generating=0.
   */
  async ensureQueuedForExamIfDue(schoolId: number, examId: number): Promise<number> {
    const now = Date.now();
    const last = this.ensureQueuedLastRun.get(examId) ?? 0;
    if (now - last < ENSURE_QUEUED_COOLDOWN_MS) {
      return this.requeueOrphanedPendingForExam(schoolId, examId);
    }
    this.ensureQueuedLastRun.set(examId, now);
    return this.ensureQueuedForExam(schoolId, examId);
  }

  /** Status breakdown for an exam, for admin progress UI. */
  async statusCounts(schoolId: number, examId: number) {
    const where = { school_id: schoolId, exam_id: examId };
    // Remove orphan skipped rows (students without marks for this exam).
    await this.prisma.marksheet_files.deleteMany({ where: { ...where, status: 'skipped' } });

    const [grouped, bundleGrouped] = await Promise.all([
      this.prisma.marksheet_files.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.marksheet_bundles.groupBy({ by: ['status'], where, _count: { _all: true } }),
    ]);
    const tally = (rows: typeof grouped) => {
      const out: any = {
        pending: 0,
        generating: 0,
        ready: 0,
        failed: 0,
        skipped: 0,
        stale: 0,
        total: 0,
        done: 0,
      };
      for (const g of rows) {
        out[g.status] = g._count._all;
      }
      return out;
    };
    const rawStudents = tally(grouped);
    const students = {
      ...rawStudents,
      total: rawStudents.ready + rawStudents.pending + rawStudents.generating + rawStudents.failed,
      done: rawStudents.ready,
    };
    const bundles = tally(bundleGrouped);
    bundles.total = bundles.ready + bundles.pending + bundles.generating + bundles.failed;
    const staleBundles = await this.listStaleBundles(schoolId, examId);
    const failedBundles = await this.prisma.marksheet_bundles.findMany({
      where: { ...where, status: 'failed' },
      select: { class: true, section: true, error: true },
      orderBy: [{ class: 'asc' }, { section: 'asc' }],
    });
    bundles.stale = staleBundles.length;
    bundles.staleItems = staleBundles;
    bundles.failedItems = failedBundles.map((b) => ({
      class: b.class,
      section: b.section,
      error: b.error,
    }));
    bundles.done = Math.max(0, bundles.ready - staleBundles.length);
    return { ...students, bundles };
  }

  /** Queue entrypoint: dispatch to the student, bundle, or session processor. */
  async processJob(job: MarksheetJob): Promise<void> {
    if (job.kind === 'bundle') {
      return this.processBundleJob(job);
    }
    if (job.kind === 'session-student') {
      return this.processSessionJob(job, job.studentId);
    }
    if (job.kind === 'session-year') {
      return this.processSessionJob(job, SESSION_YEAR_STUDENT_ID);
    }
    return this.processStudentJob(job);
  }

  /**
   * On deploy/boot: enqueue open-exam files/bundles whose
   * `snapshot_design_version` is missing or ≠ MARKSHEET_DESIGN_VERSION.
   * Frozen exams skipped. Idempotent — once rows are regenerated with the
   * current version, later boots find nothing outdated.
   */
  async applyDesignVersionBumpIfNeeded(): Promise<void> {
    const schools = await this.prisma.school.findMany({ select: { id: true } });
    let outdatedStudents = 0;
    let outdatedBundles = 0;

    for (const { id: schoolId } of schools) {
      const counts = await runWithRlsContext({ schoolId, isSuperAdmin: false }, () =>
        this.enqueueOutdatedDesignForSchool(schoolId),
      );
      outdatedStudents += counts.students;
      outdatedBundles += counts.bundles;
    }

    if (outdatedStudents === 0 && outdatedBundles === 0) {
      logger.info('[marksheet] design bump: all open caches current', {
        version: MARKSHEET_DESIGN_VERSION,
      });
      return;
    }

    logger.info('[marksheet] design bump: enqueued outdated open caches', {
      version: MARKSHEET_DESIGN_VERSION,
      students: outdatedStudents,
      bundles: outdatedBundles,
      schools: schools.length,
    });
  }

  /**
   * Startup recovery: reset sheets stuck in `generating` or left `failed`,
   * promote ready bundles pinned stale (`input_hash` null) to pending, and
   * re-enqueue them. Empty-bundle failures stay terminal (`skipped`).
   * Safe to run on every boot.
   */
  async recover(): Promise<void> {
    const schools = await this.prisma.school.findMany({ select: { id: true } });
    let totalStudents = 0;
    let totalBundles = 0;
    let queuedStudents = 0;
    let queuedBundles = 0;
    let pinnedStaleBundles = 0;

    for (const { id: schoolId } of schools) {
      const counts = await runWithRlsContext(workerRls(schoolId), () =>
        this.recoverSchool(schoolId),
      );
      totalStudents += counts.students;
      totalBundles += counts.bundles;
      pinnedStaleBundles += counts.pinned;
      queuedStudents += counts.queuedStudents;
      queuedBundles += counts.queuedBundles;
    }

    if (totalStudents === 0 && totalBundles === 0) return;

    logger.info('[marksheet] recover: re-enqueued pending/failed on startup', {
      students: totalStudents,
      bundles: totalBundles,
      pinnedStaleBundles,
      queuedStudents,
      queuedBundles,
      schools: schools.length,
    });
  }

  private async recoverSchool(schoolId: number) {
    await this.prisma.marksheet_bundles.updateMany({
      where: {
        school_id: schoolId,
        status: 'failed',
        OR: EMPTY_BUNDLE_MESSAGES.map((m) => ({ error: { contains: m } })),
      },
      data: { status: 'skipped', error: null, attempts: 0 },
    });

    const pinned = await this.prisma.marksheet_bundles.updateMany({
      where: { school_id: schoolId, status: 'ready', input_hash: null },
      data: { status: 'pending', error: null },
    });

    const stuck = { school_id: schoolId, status: { in: ['generating', 'failed'] } };
    await Promise.all([
      this.prisma.marksheet_files.updateMany({
        where: stuck,
        data: { status: 'pending', error: null },
      }),
      this.prisma.marksheet_bundles.updateMany({
        where: stuck,
        data: { status: 'pending', error: null },
      }),
    ]);

    const [pending, pendingBundles] = await Promise.all([
      this.prisma.marksheet_files.findMany({
        where: { school_id: schoolId, status: 'pending' },
        select: { student_id: true, exam_id: true, exam_name: true, year: true },
      }),
      this.prisma.marksheet_bundles.findMany({
        where: { school_id: schoolId, status: 'pending' },
        select: { exam_id: true, exam_name: true, year: true, class: true, section: true },
      }),
    ]);

    let queuedStudents = 0;
    for (const r of pending) {
      const ok = await ensureJobQueued(
        this.queue,
        {
          studentId: r.student_id,
          examId: r.exam_id,
          examName: r.exam_name,
          year: r.year,
          schoolId,
        },
        jobId(schoolId, r.exam_id, r.student_id),
        PRIORITY_BACKFILL,
      );
      if (ok) queuedStudents++;
    }

    let queuedBundles = 0;
    for (const r of pendingBundles) {
      const ok = await ensureJobQueued(
        this.queue,
        {
          kind: 'bundle' as const,
          examId: r.exam_id,
          examName: r.exam_name,
          year: r.year,
          class: r.class,
          schoolId,
          bundleSection: r.section,
        },
        bundleJobId(schoolId, r.exam_id, r.class, r.section),
        PRIORITY_BACKFILL,
      );
      if (ok) queuedBundles++;
    }

    return {
      students: pending.length,
      bundles: pendingBundles.length,
      pinned: pinned.count,
      queuedStudents,
      queuedBundles,
    };
  }

  /** Re-attach Bull jobs for DB pending/failed rows only (no gap-fill invalidate). */
  private async requeueOrphanedPendingForExam(schoolId: number, examId: number): Promise<number> {
    const queued =
      (await this.requeuePendingStudents(schoolId, examId)) +
      (await this.ensureBundlesQueuedForExam(schoolId, examId));
    if (queued > 0) {
      logger.info('[marksheet] ensureQueued: orphan pending re-attached', {
        examId,
        count: queued,
      });
    }
    return queued;
  }

  private async ensureQueuedForExam(schoolId: number, examId: number): Promise<number> {
    const exam = await this.prisma.exams.findUnique({
      where: { id: examId, school_id: schoolId },
      select: { id: true },
    });
    // Visible does not gate generation — only result_date freeze does.
    if (!exam) return 0;

    const marks = await this.prisma.marks.findMany({
      where: { school_id: schoolId, exam_id: examId, marks: { not: null } },
      distinct: ['enrollment_id'],
      select: { enrollment: { select: { student_id: true } } },
    });
    const studentIds = [
      ...new Set(
        marks.map((m) => m.enrollment?.student_id).filter((id): id is number => id != null),
      ),
    ];
    if (studentIds.length === 0) {
      return this.ensureBundlesQueuedForExam(schoolId, examId);
    }

    const existing = await this.prisma.marksheet_files.findMany({
      where: { school_id: schoolId, exam_id: examId, student_id: { in: studentIds } },
      select: { student_id: true, status: true },
    });
    const statusByStudent = new Map(existing.map((r) => [r.student_id, r.status]));

    const needQueue = studentIds.filter((sid) => {
      const st = statusByStudent.get(sid);
      if (!st) return true;
      if (st === 'failed') return true;
      return st !== 'ready' && st !== 'pending' && st !== 'generating';
    });

    let queued = 0;
    if (needQueue.length > 0) {
      await this.cache.invalidate(schoolId, needQueue, examId);
      queued += needQueue.length;
      logger.info('[marksheet] ensureQueued: gap-fill for exam', {
        examId,
        count: needQueue.length,
      });
    }

    // Pending rows whose Bull job was lost (stall / restart) never leave pending
    // unless we re-add them — invalidate() skips status===pending.
    queued += await this.requeuePendingStudents(schoolId, examId, studentIds);
    queued += await this.ensureBundlesQueuedForExam(schoolId, examId);
    return queued;
  }

  /** ensureJobQueued for pending/failed student rows of an exam (optionally limited to some students). */
  private async requeuePendingStudents(
    schoolId: number,
    examId: number,
    studentIds?: number[],
  ): Promise<number> {
    const rows = await this.prisma.marksheet_files.findMany({
      where: {
        school_id: schoolId,
        exam_id: examId,
        ...(studentIds ? { student_id: { in: studentIds } } : {}),
        status: { in: ['pending', 'failed'] },
      },
      select: { student_id: true, exam_name: true, year: true },
    });
    let queued = 0;
    for (const r of rows) {
      const didAdd = await ensureJobQueued(
        this.queue,
        { studentId: r.student_id, examId, examName: r.exam_name, year: r.year, schoolId },
        jobId(schoolId, examId, r.student_id),
      );
      if (didAdd) queued++;
    }
    return queued;
  }

  /**
   * Re-queue class bundles stuck in pending/failed (or orphaned generating)
   * when their Bull job is missing — otherwise status stays pending forever.
   */
  private async ensureBundlesQueuedForExam(schoolId: number, examId: number): Promise<number> {
    // Orphaned generating: worker died after claim, job gone from Redis.
    const generating = await this.prisma.marksheet_bundles.findMany({
      where: { school_id: schoolId, exam_id: examId, status: 'generating' },
      select: { class: true, section: true },
    });
    for (const row of generating) {
      const job = await this.queue.getJob(bundleJobId(schoolId, examId, row.class, row.section));
      const state = job ? await job.getState() : null;
      if (state === 'active') continue;
      await this.prisma.marksheet_bundles.updateMany({
        where: {
          school_id: schoolId,
          exam_id: examId,
          class: row.class,
          section: row.section,
          status: 'generating',
        },
        data: { status: 'pending', error: null },
      });
    }

    const pendingBundles = await this.prisma.marksheet_bundles.findMany({
      where: {
        school_id: schoolId,
        exam_id: examId,
        OR: [{ status: 'pending' }, { status: 'failed', attempts: { lt: MAX_BUNDLE_ATTEMPTS } }],
      },
      select: { exam_name: true, year: true, class: true, section: true },
    });
    if (pendingBundles.length === 0) return 0;

    let added = 0;
    for (const r of pendingBundles) {
      const didAdd = await ensureJobQueued(
        this.queue,
        {
          kind: 'bundle',
          examId,
          examName: r.exam_name,
          year: r.year,
          class: r.class,
          schoolId,
          bundleSection: r.section,
        },
        bundleJobId(schoolId, examId, r.class, r.section),
      );
      if (didAdd) added++;
    }
    if (added > 0) {
      logger.info('[marksheet] ensureQueued: re-queued pending bundles', { examId, count: added });
    }
    return added;
  }

  /** Enqueue open-exam rows for one school that are behind MARKSHEET_DESIGN_VERSION. */
  private async enqueueOutdatedDesignForSchool(
    schoolId: number,
  ): Promise<{ students: number; bundles: number }> {
    const exams = await this.prisma.exams.findMany({
      where: { school_id: schoolId },
      select: { id: true, result_date: true },
    });
    const openExamIds = exams.filter((e) => !isExamFrozen(e.result_date)).map((e) => e.id);
    if (openExamIds.length === 0) return { students: 0, bundles: 0 };

    const outdatedWhere = {
      school_id: schoolId,
      exam_id: { in: openExamIds },
      status: { in: ['ready', 'failed'] },
      OR: [
        { snapshot_design_version: null },
        { snapshot_design_version: { not: MARKSHEET_DESIGN_VERSION } },
      ],
    };

    const [outdatedFiles, outdatedBundleRows] = await Promise.all([
      this.prisma.marksheet_files.findMany({
        where: outdatedWhere,
        select: { student_id: true, exam_id: true, exam_name: true, year: true },
      }),
      this.prisma.marksheet_bundles.findMany({
        where: outdatedWhere,
        select: { exam_id: true, exam_name: true, year: true, class: true, section: true },
      }),
    ]);

    if (outdatedFiles.length > 0) {
      await this.prisma.marksheet_files.updateMany({
        where: { ...outdatedWhere, student_id: { in: outdatedFiles.map((r) => r.student_id) } },
        data: { status: 'pending', error: null },
      });
      await this.queue.addBulk(
        outdatedFiles.map((r) => ({
          data: {
            studentId: r.student_id,
            examId: r.exam_id,
            examName: r.exam_name,
            year: r.year,
            schoolId,
          },
          opts: {
            jobId: jobId(schoolId, r.exam_id, r.student_id),
            ...defaultJobOpts(PRIORITY_BACKFILL),
          },
        })),
      );
    }

    if (outdatedBundleRows.length > 0) {
      await this.prisma.marksheet_bundles.updateMany({
        where: outdatedWhere,
        data: { status: 'pending', error: null },
      });
      await this.queue.addBulk(
        outdatedBundleRows.map((r) => ({
          data: {
            kind: 'bundle' as const,
            examId: r.exam_id,
            examName: r.exam_name,
            year: r.year,
            class: r.class,
            schoolId,
            bundleSection: r.section,
          },
          opts: {
            jobId: bundleJobId(schoolId, r.exam_id, r.class, r.section),
            ...defaultJobOpts(PRIORITY_BACKFILL),
          },
        })),
      );
    }

    return { students: outdatedFiles.length, bundles: outdatedBundleRows.length };
  }

  /**
   * Ready bundle rows that need regen. Once a live-hash mismatch is seen we
   * clear `input_hash` so the row stays "stale" across polls until download
   * regenerates it — without that pin, a flaky fingerprint (or a concurrent
   * regen) can make staleItems thrash request-to-request.
   */
  private async listStaleBundles(
    schoolId: number,
    examId: number,
  ): Promise<{ class: number; section: string }[]> {
    const rows = await this.prisma.marksheet_bundles.findMany({
      where: { school_id: schoolId, exam_id: examId, status: 'ready' },
      select: { id: true, class: true, section: true, year: true, input_hash: true },
      orderBy: [{ class: 'asc' }, { section: 'asc' }],
    });
    if (rows.length === 0) return [];

    const stale: { class: number; section: string }[] = [];
    const pinIds: number[] = [];

    for (const row of rows) {
      if (!row.input_hash) {
        stale.push({ class: row.class, section: row.section });
        continue;
      }
      const liveHash = await this.hash.computeBundleHash(
        schoolId,
        examId,
        row.class,
        row.year,
        row.section,
      );
      if (row.input_hash !== liveHash) {
        stale.push({ class: row.class, section: row.section });
        pinIds.push(row.id);
      }
    }

    if (pinIds.length > 0) {
      await this.prisma.marksheet_bundles.updateMany({
        where: { school_id: schoolId, id: { in: pinIds } },
        data: { input_hash: null },
      });
    }

    return stale;
  }

  /**
   * Re-enqueue after the current Bull job finishes. Uses ensureJobQueuedAfterDefer
   * so a same-jobId race or completed/failed orphan cannot leave the DB row
   * pending with nothing in Redis.
   */
  private deferStudentRequeue(job: StudentJob): void {
    const id = jobId(job.schoolId, job.examId, job.studentId);
    setImmediate(() => {
      ensureJobQueuedAfterDefer(this.queue, job, id, PRIORITY_BACKFILL).then((ok) => {
        if (!ok) {
          logger.warn('[marksheet] requeue(student) still not queued after retries', {
            studentId: job.studentId,
            examId: job.examId,
          });
        }
      });
    });
  }

  private deferBundleRequeue(job: BundleJob, delayMs = 0): void {
    const bundleSection = bundleSectionKey(job.bundleSection);
    const id = bundleJobId(job.schoolId, job.examId, job.class, bundleSection);
    const run = () => {
      ensureJobQueuedAfterDefer(
        this.queue,
        { ...job, kind: 'bundle', bundleSection },
        id,
        PRIORITY_BACKFILL,
      ).then((ok) => {
        if (!ok) {
          logger.warn('[marksheet] requeue(bundle) still not queued after retries', {
            examId: job.examId,
            class: job.class,
            section: bundleSection,
          });
        }
      });
    };
    if (delayMs > 0) setTimeout(run, delayMs);
    else setImmediate(run);
  }

  /**
   * True when a concurrent mark edit invalidated this row or changed inputs
   * while we were rendering — do not promote to ready.
   */
  private async studentJobStale(
    schoolId: number,
    studentId: number,
    examId: number,
    year: number,
    hashAtStart: string,
  ): Promise<boolean> {
    const [hashAtEnd, row] = await Promise.all([
      this.hash.computeInputHash(schoolId, studentId, examId, year),
      this.prisma.marksheet_files.findUnique({
        where: marksheetStudentWhere(schoolId, studentId, examId),
        select: { status: true },
      }),
    ]);
    return hashAtEnd !== hashAtStart || row?.status !== 'generating';
  }

  private async bundleJobStale(
    schoolId: number,
    examId: number,
    cls: number,
    year: number,
    bundleSection: string,
    hashAtStart: string,
  ): Promise<boolean> {
    const [hashAtEnd, row] = await Promise.all([
      this.hash.computeBundleHash(schoolId, examId, cls, year, bundleSection),
      this.prisma.marksheet_bundles.findUnique({
        where: marksheetBundleWhere(schoolId, examId, cls, bundleSection),
        select: { status: true },
      }),
    ]);
    return hashAtEnd !== hashAtStart || row?.status !== 'generating';
  }

  /**
   * Process one student job: claim the row, skip if inputs unchanged, else
   * render + upload. Runs OUTSIDE any HTTP request, so it establishes the
   * RLS context itself from the job's schoolId (RLS is the backup to the
   * explicit school_id filters).
   */
  private async processStudentJob(job: StudentJob): Promise<void> {
    const { studentId, examId, examName, year, schoolId } = job;
    const t0 = Date.now();
    await runWithRlsContext(workerRls(schoolId), async () => {
      // Atomic claim: only the worker that transitions pending/failed ->
      // generating proceeds. Concurrent duplicates see count 0 and bail.
      const claim = await this.prisma.marksheet_files.updateMany({
        where: {
          school_id: schoolId,
          student_id: studentId,
          exam_id: examId,
          status: { in: ['pending', 'failed'] },
        },
        data: { status: 'generating', attempts: { increment: 1 } },
      });
      if (claim.count === 0) {
        logger.debug('[marksheet] job(student): not claimable, skipping', { studentId, examId });
        return; // already ready, or owned by another worker
      }
      logger.info('[marksheet] job(student): claimed', { studentId, examId });

      const whereStudent = marksheetStudentWhere(schoolId, studentId, examId);
      try {
        const [row, exam] = await Promise.all([
          this.prisma.marksheet_files.findUnique({
            where: whereStudent,
            select: {
              input_hash: true,
              r2_key: true,
              snapshot_head_id: true,
              snapshot_head_role: true,
              snapshot_teacher_id: true,
              snapshot_signatory_detail: true,
              snapshot_design_version: true,
            },
          }),
          this.prisma.exams.findUnique({
            where: { id: examId, school_id: schoolId },
            select: { result_date: true },
          }),
        ]);
        const frozen = isExamFrozen(exam?.result_date);
        // Frozen sheets keep the design they were sealed with — never bump to
        // live MARKSHEET_DESIGN_VERSION mid-job (that flips the hash and
        // livelocks DEFER after render).
        const designToStore = frozen
          ? (row?.snapshot_design_version ?? MARKSHEET_DESIGN_VERSION)
          : MARKSHEET_DESIGN_VERSION;
        let signatoryDetail = parseSignatoryDetail(row?.snapshot_signatory_detail);

        // Legacy frozen rows: capture name/sig/phone once before hashing so
        // history pins without a live↔detail hash flap.
        if (
          frozen &&
          row &&
          (row.snapshot_head_id != null || row.snapshot_teacher_id != null) &&
          !signatoryDetail
        ) {
          const [headLive, teacherLive] = await Promise.all([
            this.hash.headFingerprintById(schoolId, row.snapshot_head_id, row.snapshot_head_role),
            row.snapshot_teacher_id != null
              ? this.prisma.teachers.findUnique({
                  where: { id: row.snapshot_teacher_id, school_id: schoolId },
                  select: { id: true, name: true, signature: true, phone: true },
                })
              : Promise.resolve(null),
          ]);
          signatoryDetail = await captureStudentSignatoryDetail(
            schoolId,
            examId,
            { id: headLive.id, name: headLive.name, signature: headLive.sig },
            teacherLive,
          );
          await this.prisma.marksheet_files.update({
            where: whereStudent,
            data: { snapshot_signatory_detail: signatoryDetail },
          });
        }

        const hashAtStart = await this.hash.computeInputHash(schoolId, studentId, examId, year);

        const frozenSignatories =
          frozen && row && (row.snapshot_head_id != null || row.snapshot_teacher_id != null)
            ? {
                headId: row.snapshot_head_id,
                headRole: row.snapshot_head_role,
                teacherId: row.snapshot_teacher_id,
                detail: signatoryDetail,
              }
            : undefined;
        // Nothing changed and the object is still there — no render needed.
        if (row?.input_hash === hashAtStart && row.r2_key && (await headObject(row.r2_key))) {
          if (await this.studentJobStale(schoolId, studentId, examId, year, hashAtStart)) {
            await this.prisma.marksheet_files.update({
              where: whereStudent,
              data: { status: 'pending', error: null },
            });
            this.deferStudentRequeue(job);
            logger.info('[marksheet] job(student): DEFER after skip (concurrent edit)', {
              studentId,
              examId,
              ms: Date.now() - t0,
            });
            return;
          }
          await this.prisma.marksheet_files.update({
            where: whereStudent,
            data: { status: 'ready', error: null },
          });
          logger.info('[marksheet] job(student): SKIP render (inputs unchanged)', {
            studentId,
            examId,
            ms: Date.now() - t0,
          });
          return;
        }

        logger.info('[marksheet] job(student): rendering', {
          studentId,
          examId,
          reason: !row?.input_hash
            ? 'first-render'
            : row.input_hash !== hashAtStart
              ? 'inputs-changed'
              : 'r2-missing',
        });
        const {
          buffer,
          studentName,
          usedHeadId,
          usedHeadRole,
          usedTeacherId,
          usedHeadName,
          usedHeadSignature,
          usedTeacherName,
          usedTeacherSignature,
          usedTeacherPhone,
        } = await this.renderer.generateMarksheetPDF(
          schoolId,
          studentId,
          year,
          examName,
          WORKER_USER,
          frozenSignatories,
        );
        const key = r2Key(schoolId, year, examId, studentId);
        await uploadToR2(key, buffer);

        // Reuse pre-hash detail when present. Re-capturing after render and
        // writing it before hashAtEnd was flipping frozen fingerprints
        // (live path+ETag → frozen path) and causing infinite DEFER.
        const detailToStore =
          signatoryDetail ??
          (await captureStudentSignatoryDetail(
            schoolId,
            examId,
            { id: usedHeadId, name: usedHeadName, signature: usedHeadSignature },
            {
              id: usedTeacherId,
              name: usedTeacherName,
              signature: usedTeacherSignature,
              phone: usedTeacherPhone,
            },
          ));

        if (await this.studentJobStale(schoolId, studentId, examId, year, hashAtStart)) {
          await this.prisma.marksheet_files.update({
            where: whereStudent,
            data: { status: 'pending', error: null },
          });
          this.deferStudentRequeue(job);
          logger.info('[marksheet] job(student): DEFER after render (concurrent edit)', {
            studentId,
            examId,
            key,
            bytes: buffer.length,
            ms: Date.now() - t0,
          });
          return;
        }

        await this.prisma.marksheet_files.update({
          where: whereStudent,
          data: {
            status: 'ready',
            r2_key: key,
            input_hash: hashAtStart,
            student_name: studentName,
            snapshot_head_id: usedHeadId,
            snapshot_head_role: usedHeadRole,
            snapshot_teacher_id: usedTeacherId,
            snapshot_signatory_detail: detailToStore,
            snapshot_design_version: designToStore,
            generated_at: new Date(),
            error: null,
          },
        });
        logger.info('[marksheet] job(student): READY', {
          studentId,
          examId,
          key,
          bytes: buffer.length,
          ms: Date.now() - t0,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // A student with no real marks isn't a failure — it's nothing to
        // render. Mark terminal so Bull doesn't retry it.
        if (message.includes('No marks found')) {
          await this.prisma.marksheet_files.delete({ where: whereStudent }).catch(() => {});
          logger.info('[marksheet] job(student): SKIPPED (no marks)', { studentId, examId });
          return;
        }
        await this.prisma.marksheet_files
          .update({ where: whereStudent, data: { status: 'failed', error: message } })
          .catch(() => {});
        logger.error('[marksheet] job(student): FAILED', { studentId, examId, error: message });
        throw err; // let Bull retry per job attempts
      }
    });
  }

  /** Session PDF (one student, or the school-year "all" PDF when studentId is 0). */
  private async processSessionJob(
    job: SessionStudentJob | SessionYearJob,
    studentId: number,
  ): Promise<void> {
    const { year, schoolId } = job;
    const isYear = job.kind === 'session-year';
    const label = isYear ? 'session-year' : 'session-student';
    const logCtx = isYear ? { year } : { studentId, year };
    const computeHash = () =>
      isYear
        ? this.hash.computeSessionYearHash(schoolId, year)
        : this.hash.computeSessionStudentHash(schoolId, studentId, year);

    await runWithRlsContext(workerRls(schoolId), async () => {
      const whereKey = marksheetSessionWhere(schoolId, year, studentId);
      await this.prisma.marksheet_sessions.upsert({
        where: whereKey,
        create: {
          school_id: schoolId,
          year,
          student_id: studentId,
          status: 'generating',
          attempts: 1,
        },
        update: { status: 'generating', attempts: { increment: 1 }, error: null },
      });

      try {
        const hashAtStart = await computeHash();
        const existing = await this.prisma.marksheet_sessions.findUnique({
          where: whereKey,
          select: { input_hash: true, r2_key: true },
        });
        if (
          existing?.input_hash === hashAtStart &&
          existing.r2_key &&
          (await headObject(existing.r2_key))
        ) {
          await this.prisma.marksheet_sessions.update({
            where: whereKey,
            data: { status: 'ready', error: null },
          });
          logger.info(`[marksheet] job(${label}): SKIP render`, logCtx);
          return;
        }

        const buffer = await this.renderer.generateAllMarksheetsPDF(
          schoolId,
          year,
          isYear ? undefined : studentId,
        );
        const key = isYear
          ? r2SessionYearKey(schoolId, year)
          : r2SessionStudentKey(schoolId, year, studentId);
        const hashAtEnd = await computeHash();
        if (hashAtEnd !== hashAtStart) {
          await this.prisma.marksheet_sessions.update({
            where: whereKey,
            data: { status: 'pending', error: null },
          });
          const id = isYear
            ? sessionYearJobId(schoolId, year)
            : sessionStudentJobId(schoolId, year, studentId);
          setImmediate(() => {
            enqueueUserPriority(this.queue, job, id).catch(() => {});
          });
          logger.info(`[marksheet] job(${label}): DEFER after render (concurrent edit)`, {
            ...logCtx,
            bytes: buffer.length,
          });
          return;
        }

        await uploadToR2(key, buffer);
        await this.prisma.marksheet_sessions.update({
          where: whereKey,
          data: {
            status: 'ready',
            r2_key: key,
            input_hash: hashAtEnd,
            generated_at: new Date(),
            error: null,
          },
        });
        logger.info(`[marksheet] job(${label}): READY`, { ...logCtx, bytes: buffer.length });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await this.prisma.marksheet_sessions
          .update({ where: whereKey, data: { status: 'failed', error: msg.slice(0, 500) } })
          .catch(() => {});
        throw e;
      }
    });
  }

  /**
   * Students in bundle scope with at least one non-null mark, in PDF page order
   * (section, roll, name).
   */
  private async listBundleMembers(
    schoolId: number,
    examId: number,
    cls: number,
    year: number,
    bundleSection: string,
  ): Promise<{ studentId: number; section: string }[]> {
    const enrollments = await this.prisma.student_enrollments.findMany({
      where: enrollmentWhereForBundleSection(schoolId, cls, year, bundleSection),
      select: { id: true, student_id: true, section: true },
      orderBy: [{ section: 'asc' }, { roll: 'asc' }, { student: { name: 'asc' } }],
    });
    if (enrollments.length === 0) return [];

    const withMarks = await this.prisma.marks.findMany({
      where: {
        school_id: schoolId,
        exam_id: examId,
        marks: { not: null },
        enrollment_id: { in: enrollments.map((e) => e.id) },
      },
      distinct: ['enrollment_id'],
      select: { enrollment_id: true },
    });
    const ok = new Set(withMarks.map((m) => m.enrollment_id));
    return enrollments
      .filter((e) => ok.has(e.id))
      .map((e) => ({ studentId: e.student_id, section: e.section }));
  }

  /** Queue user-priority student jobs for members that are missing or stale. */
  private async enqueueStaleBundleMembers(
    schoolId: number,
    staleStudentIds: number[],
    examId: number,
    examName: string,
    year: number,
  ): Promise<void> {
    if (staleStudentIds.length === 0) return;

    const existing = await this.prisma.marksheet_files.findMany({
      where: { school_id: schoolId, exam_id: examId, student_id: { in: staleStudentIds } },
      select: { student_id: true },
    });
    const have = new Set(existing.map((r) => r.student_id));
    const missing = staleStudentIds.filter((id) => !have.has(id));
    if (missing.length > 0) {
      await this.prisma.marksheet_files
        .createMany({
          data: missing.map((id) => ({
            student_id: id,
            exam_id: examId,
            exam_name: examName,
            year,
            school_id: schoolId,
            status: 'pending',
          })),
          skipDuplicates: true,
        })
        .catch(() => {});
    }

    await this.prisma.marksheet_files.updateMany({
      where: {
        school_id: schoolId,
        exam_id: examId,
        student_id: { in: staleStudentIds },
        status: { not: 'generating' },
      },
      data: { status: 'pending', error: null },
    });

    await Promise.all(
      staleStudentIds.map((studentId) =>
        enqueueUserPriority(
          this.queue,
          { studentId, examId, examName, year, schoolId },
          jobId(schoolId, examId, studentId),
        ).catch(() => {}),
      ),
    );
  }

  private async processBundleJob(job: BundleJob): Promise<void> {
    const { examId, examName, year, class: cls, schoolId } = job;
    const bundleSection = bundleSectionKey(job.bundleSection);
    const t0 = Date.now();
    const logCtx = { examId, class: cls, section: bundleSection };
    await runWithRlsContext(workerRls(schoolId), async () => {
      const claim = await this.prisma.marksheet_bundles.updateMany({
        where: {
          school_id: schoolId,
          exam_id: examId,
          class: cls,
          section: bundleSection,
          status: { in: ['pending', 'failed'] },
        },
        data: { status: 'generating', attempts: { increment: 1 } },
      });
      if (claim.count === 0) {
        logger.debug('[marksheet] job(bundle): not claimable, skipping', logCtx);
        return;
      }
      logger.info('[marksheet] job(bundle): claimed', logCtx);

      const whereKey = marksheetBundleWhere(schoolId, examId, cls, bundleSection);
      const deferBundle = async (delayMs = 0) => {
        await this.prisma.marksheet_bundles.update({
          where: whereKey,
          data: { status: 'pending', error: null },
        });
        this.deferBundleRequeue({ ...job, bundleSection }, delayMs);
      };
      try {
        const [examRow, snapRow] = await Promise.all([
          this.prisma.exams.findUnique({
            where: { id: examId, school_id: schoolId },
            select: { result_date: true },
          }),
          this.prisma.marksheet_bundles.findUnique({
            where: whereKey,
            select: {
              snapshot_head_id: true,
              snapshot_head_role: true,
              snapshot_teachers: true,
              snapshot_signatory_detail: true,
              snapshot_design_version: true,
            },
          }),
        ]);
        const frozen = isExamFrozen(examRow?.result_date);
        // Frozen bundles keep sealed design — writing live version before
        // hashAtEnd caused DEFER after merge livelock.
        const designToStore = frozen
          ? (snapRow?.snapshot_design_version ?? MARKSHEET_DESIGN_VERSION)
          : MARKSHEET_DESIGN_VERSION;
        const snapTeachers = (snapRow?.snapshot_teachers ?? null) as Record<string, number> | null;
        if (
          frozen &&
          snapRow &&
          (snapRow.snapshot_head_id != null ||
            (snapTeachers && Object.keys(snapTeachers).length > 0)) &&
          !parseSignatoryDetail(snapRow.snapshot_signatory_detail)
        ) {
          const [headLive, teachersLive] = await Promise.all([
            this.hash.headFingerprintById(
              schoolId,
              snapRow.snapshot_head_id,
              snapRow.snapshot_head_role,
            ),
            this.hash.teacherFingerprintByIds(schoolId, snapTeachers ?? {}),
          ]);
          const teachersDetail: Record<
            string,
            { name: string | null; signature: string | null; phone: string | null }
          > = {};
          for (const t of teachersLive) {
            teachersDetail[t.sec] = {
              name: t.name,
              signature: await freezeSignatoryAsset(
                schoolId,
                examId,
                `teacher-${t.id}-sec-${t.sec}`,
                t.sig,
              ),
              phone: null,
            };
          }
          const detail = {
            head:
              headLive.id != null
                ? {
                    name: headLive.name,
                    signature: await freezeSignatoryAsset(
                      schoolId,
                      examId,
                      `head-${headLive.id}`,
                      headLive.sig,
                    ),
                  }
                : null,
            teachers: teachersDetail,
          };
          await this.prisma.marksheet_bundles.update({
            where: whereKey,
            data: { snapshot_signatory_detail: detail },
          });
        }

        const hashAtStart = await this.hash.computeBundleHash(
          schoolId,
          examId,
          cls,
          year,
          bundleSection,
        );
        const row = await this.prisma.marksheet_bundles.findUnique({
          where: whereKey,
          select: { input_hash: true, r2_key: true },
        });
        if (row?.input_hash === hashAtStart && row.r2_key && (await headObject(row.r2_key))) {
          if (await this.bundleJobStale(schoolId, examId, cls, year, bundleSection, hashAtStart)) {
            await deferBundle();
            logger.info('[marksheet] job(bundle): DEFER after skip (concurrent edit)', {
              ...logCtx,
              ms: Date.now() - t0,
            });
            return;
          }
          await this.prisma.marksheet_bundles.update({
            where: whereKey,
            data: { status: 'ready', error: null },
          });
          logger.info('[marksheet] job(bundle): SKIP merge (inputs unchanged)', {
            ...logCtx,
            ms: Date.now() - t0,
          });
          return;
        }

        const members = await this.listBundleMembers(schoolId, examId, cls, year, bundleSection);
        if (members.length === 0) {
          throw new Error('No non-null marks found for any student in this class.');
        }

        const memberRows = await this.prisma.marksheet_files.findMany({
          where: {
            school_id: schoolId,
            exam_id: examId,
            student_id: { in: members.map((m) => m.studentId) },
          },
          select: {
            student_id: true,
            status: true,
            input_hash: true,
            r2_key: true,
            snapshot_head_id: true,
            snapshot_head_role: true,
            snapshot_teacher_id: true,
            snapshot_signatory_detail: true,
          },
        });
        const rowByStudent = new Map(memberRows.map((r) => [r.student_id, r]));

        const staleStudentIds: number[] = [];
        const inFlightStudentIds: number[] = [];
        for (const m of members) {
          const fileRow = rowByStudent.get(m.studentId) ?? null;
          if (await this.hash.isStudentCacheFresh(schoolId, m.studentId, examId, year, fileRow)) {
            continue;
          }

          const st = fileRow?.status;
          // Content already matches live hash + R2, but the row is still
          // pending/generating (e.g. a skip-bound job). Wait — do not treat
          // as needing regen, or we livelock: enqueue → SKIP → reclaim → …
          if (
            (st === 'generating' || st === 'pending') &&
            (await this.hash.isStudentContentFresh(schoolId, m.studentId, examId, year, fileRow))
          ) {
            inFlightStudentIds.push(m.studentId);
            continue;
          }

          staleStudentIds.push(m.studentId);
        }

        if (staleStudentIds.length > 0) {
          await this.enqueueStaleBundleMembers(schoolId, staleStudentIds, examId, examName, year);
          // Back off so student jobs can finish before we reclaim.
          await deferBundle(1500);
          logger.info('[marksheet] job(bundle): DEFER waiting for member PDFs', {
            ...logCtx,
            stale: staleStudentIds.length,
            inFlight: inFlightStudentIds.length,
            members: members.length,
            ms: Date.now() - t0,
          });
          return;
        }

        if (inFlightStudentIds.length > 0) {
          // Orphan pending with good content: ensure a job exists so SKIP can
          // promote to ready. Never re-invalidate generating rows.
          await Promise.all(
            inFlightStudentIds.map(async (studentId) => {
              if (rowByStudent.get(studentId)?.status !== 'pending') return;
              await ensureJobQueued(
                this.queue,
                { studentId, examId, examName, year, schoolId },
                jobId(schoolId, examId, studentId),
                PRIORITY_USER,
              ).catch(() => {});
            }),
          );
          await deferBundle(1500);
          logger.info('[marksheet] job(bundle): DEFER waiting for in-flight members', {
            ...logCtx,
            inFlight: inFlightStudentIds.length,
            members: members.length,
            ms: Date.now() - t0,
          });
          return;
        }

        // All members ready + hash-verified — safe to merge.
        logger.info('[marksheet] job(bundle): parallel download member PDFs', {
          ...logCtx,
          members: members.length,
        });
        const tDownload = Date.now();
        const fetched = await Promise.all(
          members.map(async (m) => ({
            studentId: m.studentId,
            buf: await getFileBuffer(rowByStudent.get(m.studentId)!.r2_key!),
          })),
        );
        const downloadMs = Date.now() - tDownload;
        const missingIds = fetched.filter((f) => !f.buf).map((f) => f.studentId);
        if (missingIds.length > 0) {
          await this.enqueueStaleBundleMembers(schoolId, missingIds, examId, examName, year);
          await deferBundle();
          logger.info('[marksheet] job(bundle): DEFER missing R2 member buffer', {
            ...logCtx,
            studentIds: missingIds,
            downloadMs,
            ms: Date.now() - t0,
          });
          return;
        }

        const buffers = fetched.map((f) => f.buf!);
        logger.info('[marksheet] job(bundle): parallel download done', {
          ...logCtx,
          members: members.length,
          bytes: buffers.reduce((n, b) => n + b.length, 0),
          downloadMs,
        });

        logger.info('[marksheet] job(bundle): merging member PDFs', {
          ...logCtx,
          members: members.length,
        });
        const tMerge = Date.now();
        const buffer = await mergeMarksheetPdfs(buffers);
        const mergeMs = Date.now() - tMerge;
        const key = r2BundleKey(schoolId, year, examId, cls, bundleSection);
        await uploadToR2(key, buffer);

        const usedTeachersBySection: Record<string, number> = {};
        let usedHeadId: number | null = null;
        let usedHeadRole: string | null = null;
        let bundleHeadDetail: { name: string | null; signature: string | null } | null = null;
        const bundleTeachersDetail: Record<
          string,
          { name: string | null; signature: string | null; phone: string | null }
        > = {};
        for (const m of members) {
          const fileRow = rowByStudent.get(m.studentId)!;
          const memberDetail = parseSignatoryDetail(fileRow.snapshot_signatory_detail);
          if (usedHeadId == null && fileRow.snapshot_head_id != null) {
            usedHeadId = fileRow.snapshot_head_id;
            usedHeadRole = fileRow.snapshot_head_role;
            bundleHeadDetail = memberDetail?.head ?? null;
          }
          if (fileRow.snapshot_teacher_id != null && usedTeachersBySection[m.section] == null) {
            usedTeachersBySection[m.section] = fileRow.snapshot_teacher_id;
            bundleTeachersDetail[m.section] = memberDetail?.teacher ?? {
              name: null,
              signature: null,
              phone: null,
            };
          }
        }
        // Do NOT write snapshots before hashAtEnd — that changed the frozen
        // fingerprint mid-job and livelocked DEFER after merge.

        if (await this.bundleJobStale(schoolId, examId, cls, year, bundleSection, hashAtStart)) {
          await deferBundle();
          logger.info('[marksheet] job(bundle): DEFER after merge (concurrent edit)', {
            ...logCtx,
            key,
            bytes: buffer.length,
            downloadMs,
            mergeMs,
            ms: Date.now() - t0,
          });
          return;
        }

        await this.prisma.marksheet_bundles.update({
          where: whereKey,
          data: {
            status: 'ready',
            r2_key: key,
            input_hash: hashAtStart,
            snapshot_head_id: usedHeadId,
            snapshot_head_role: usedHeadRole,
            snapshot_teachers: usedTeachersBySection,
            snapshot_signatory_detail: { head: bundleHeadDetail, teachers: bundleTeachersDetail },
            snapshot_design_version: designToStore,
            generated_at: new Date(),
            error: null,
            attempts: 0,
          },
        });
        logger.info('[marksheet] job(bundle): READY', {
          ...logCtx,
          key,
          bytes: buffer.length,
          members: members.length,
          downloadMs,
          mergeMs,
          ms: Date.now() - t0,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const isEmpty = isEmptyBundleError(message);
        await this.prisma.marksheet_bundles
          .update({
            where: whereKey,
            data: { status: isEmpty ? 'skipped' : 'failed', error: isEmpty ? null : message },
          })
          .catch(() => {});
        if (isEmpty) {
          logger.info('[marksheet] job(bundle): SKIPPED (nothing to merge)', {
            ...logCtx,
            reason: message,
          });
          return;
        }
        logger.error('[marksheet] job(bundle): FAILED', { ...logCtx, error: message });
        throw err;
      }
    });
  }
}
