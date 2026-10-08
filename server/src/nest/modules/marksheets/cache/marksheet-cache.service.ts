import {
  ForbiddenException,
  GatewayTimeoutException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaClient } from '@/generated/prisma/client.js';
import { getDownloadUrl, getFileBuffer, headObject } from '@/config/r2.js';
import { isExamFrozen } from '@/modules/exam/exam-year-end.js';
import logger from '@/utils/logger.js';
import { PRIORITY_BACKFILL, defaultJobOpts, enqueueUserPriority } from '@/utils/bullQueue.js';
import { PRISMA } from '../../../common/prisma.module.js';
import type { AuthUser } from '../../../common/current-user.decorator.js';
import {
  MARKSHEET_QUEUE,
  bundleJobId,
  jobId,
  sessionStudentJobId,
  sessionYearJobId,
} from '../jobs/marksheet.queue.js';
import type {
  BundleJob,
  MarksheetQueue,
  SessionStudentJob,
  SessionYearJob,
  StudentJob,
} from '../jobs/marksheet.queue.js';
import { MarksheetRenderer } from '../pdf/marksheet-renderer.js';
import {
  SESSION_YEAR_STUDENT_ID,
  bundleSectionKey,
  marksheetBundleWhere,
  marksheetSessionWhere,
  marksheetStudentWhere,
} from './marksheet-cache.helpers.js';
import { MarksheetHashService } from './marksheet-hash.service.js';

const SERVE_TIMEOUT_MS = Number(process.env.MARKSHEET_SERVE_TIMEOUT_MS || '180000');
const SERVE_POLL_MS = Number(process.env.MARKSHEET_SERVE_POLL_MS || '500');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Append a content fingerprint to a *stable public* download URL so a CDN in
 * front of the R2 bucket treats a regenerated file (same key/path) as a new
 * resource. Presigned URLs (SigV4) sign the ENTIRE query string, so they are
 * returned unchanged; they rotate per request and cannot be served stale anyway.
 */
function withCacheBust(url: string, hash: string | null): string {
  if (!hash) return url;
  if (/[?&]X-Amz-Signature=/i.test(url)) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${hash.slice(0, 16)}`;
}

/** Bundle keys touched by a change in `section`: itself, ALL, and composite "A+B" keys containing it. */
function bundleSectionsForTeacherChange(section: string, existingSections: string[]): string[] {
  const keys = new Set<string>([section, 'ALL']);
  for (const s of existingSections) {
    if (s === section || s === 'ALL') {
      keys.add(s);
      continue;
    }
    if (s.includes('+') && s.split('+').includes(section)) {
      keys.add(s);
    }
  }
  return [...keys];
}

/** DB/R2 key for admin whole-class / one-section, or teacher section-scoped bundles. */
function resolveBundleSection(
  user: AuthUser,
  cls: number,
  year: number,
  sectionQuery?: string,
): string {
  const requested = sectionQuery?.trim() || undefined;

  // Admin may download whole class (ALL) or one section when UI passes ?section=
  if (user.role !== 'teacher') return requested || 'ALL';

  const assignedSections: string[] = (user.levels ?? [])
    .filter((l: any) => l.class_name === cls && l.year === year)
    .map((l: any) => l.section)
    .filter(Boolean);

  if (assignedSections.length === 0) {
    throw new ForbiddenException('You are not assigned to this class.');
  }
  if (requested) {
    if (!assignedSections.includes(requested)) {
      throw new ForbiddenException('You are not assigned to this section.');
    }
    return requested;
  }
  return [...new Set(assignedSections)].sort().join('+');
}

/**
 * Serves marksheet PDFs from the worker's hash-verified R2 cache (queueing and
 * waiting when stale), and flags caches stale when their inputs change.
 */
@Injectable()
export class MarksheetCacheService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(MARKSHEET_QUEUE) private readonly queue: MarksheetQueue,
    private readonly hash: MarksheetHashService,
    private readonly renderer: MarksheetRenderer,
  ) {}

  /**
   * Return a marksheet PDF for a student. Never serves a stale cache and never
   * renders inline — always waits for the worker to produce a hash-verified
   * fresh PDF in R2.
   */
  async serve(
    schoolId: number,
    studentId: number,
    year: number,
    examName: string,
    user: AuthUser,
  ): Promise<{ buffer: Buffer; studentName: string }> {
    const t0 = Date.now();
    logger.info('[marksheet] serve: request', { studentId, examName, year, role: user.role });

    await this.renderer.verifyMarksheetDownloadAccess(schoolId, studentId, year, examName, user);

    const exam = await this.prisma.exams.findFirst({
      where: { school_id: schoolId, exam_name: examName, exam_year: year },
      select: { id: true },
    });
    if (!exam) {
      throw new InternalServerErrorException('Marksheet cache is unavailable for this exam.');
    }

    return this.waitForFreshStudentPdf(
      { studentId, examId: exam.id, examName, year, schoolId },
      t0,
    );
  }

  /**
   * Serve a class exam bundle via worker + hash-verified R2 cache.
   * Bundles (admin ALL or one section, teacher section scope) generate on
   * download only — never pre-queued on publish or mark edits.
   */
  async serveBundle(
    schoolId: number,
    year: number,
    cls: number,
    examName: string,
    user: AuthUser,
    sectionQuery?: string,
  ): Promise<{ url: string }> {
    const t0 = Date.now();
    logger.info('[marksheet] serveBundle: request', {
      class: cls,
      examName,
      year,
      role: user.role,
      sectionQuery,
    });
    const exam = await this.prisma.exams.findFirst({
      where: { school_id: schoolId, exam_name: examName, exam_year: year },
      select: { id: true },
    });
    if (!exam) {
      throw new InternalServerErrorException('Class marksheet cache is unavailable for this exam.');
    }

    const bundleSection = resolveBundleSection(user, cls, year, sectionQuery);
    return this.waitForFreshBundlePdf(
      { kind: 'bundle', examId: exam.id, examName, year, class: cls, schoolId, bundleSection },
      t0,
    );
  }

  /** Session marksheet for one student (all exams in a year). */
  async serveSessionStudent(
    schoolId: number,
    studentId: number,
    year: number,
    user: AuthUser,
  ): Promise<{ buffer: Buffer }> {
    const t0 = Date.now();
    await this.renderer.verifyMarksheetDownloadAccess(schoolId, studentId, year, '', user);
    const hash = await this.hash.computeSessionStudentHash(schoolId, studentId, year);
    const job: SessionStudentJob = { kind: 'session-student', studentId, year, schoolId };
    return this.serveSession(
      job,
      studentId,
      hash,
      sessionStudentJobId(schoolId, year, studentId),
      t0,
    );
  }

  /** All session marksheets for a school year (admin). */
  async serveSessionYear(
    schoolId: number,
    year: number,
    user: AuthUser,
  ): Promise<{ buffer: Buffer }> {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Only admins can download all session marksheets.');
    }
    const t0 = Date.now();
    const hash = await this.hash.computeSessionYearHash(schoolId, year);
    const job: SessionYearJob = { kind: 'session-year', year, schoolId };
    return this.serveSession(
      job,
      SESSION_YEAR_STUDENT_ID,
      hash,
      sessionYearJobId(schoolId, year),
      t0,
    );
  }

  /**
   * Mark the given students' sheets stale and re-enqueue. Only students with
   * real marks for this exam are queued — never creates duplicate/skipped rows.
   * Also auto-queues affected class bundles and session PDFs.
   */
  async invalidate(
    schoolId: number,
    studentIds: number[],
    examId: number,
    priority = PRIORITY_BACKFILL,
  ): Promise<void> {
    if (studentIds.length === 0) return;
    const exam = await this.prisma.exams.findUnique({
      where: { id: examId, school_id: schoolId },
      select: { exam_name: true, exam_year: true, result_date: true },
    });
    if (!exam) return;

    const eligible = await this.studentIdsWithMarksForExam(schoolId, examId, studentIds);
    if (eligible.length === 0) return;

    // Drop cache rows for students who have no marks for this exam.
    const ineligible = studentIds.filter((id) => !eligible.includes(id));
    if (ineligible.length > 0) {
      await this.prisma.marksheet_files.deleteMany({
        where: {
          school_id: schoolId,
          exam_id: examId,
          student_id: { in: ineligible },
          status: { in: ['skipped', 'pending', 'failed'] },
        },
      });
    }

    logger.info('[marksheet] invalidate(students): flagging stale + re-queue', {
      examId,
      count: eligible.length,
    });
    await this.enqueueBundlesForStudents(
      schoolId,
      examId,
      exam.exam_name,
      exam.exam_year,
      eligible,
      priority,
    );
    await this.enqueueSessionsForStudents(schoolId, eligible, exam.exam_year, priority);
    await this.prisma.marksheet_files.updateMany({
      where: { school_id: schoolId, exam_id: examId, student_id: { in: eligible } },
      data: { status: 'pending', error: null },
    });

    const existing = await this.prisma.marksheet_files.findMany({
      where: { school_id: schoolId, exam_id: examId, student_id: { in: eligible } },
      select: { student_id: true },
    });
    const have = new Set(existing.map((r) => r.student_id));
    const missing = eligible.filter((id) => !have.has(id));
    if (missing.length > 0) {
      await this.prisma.marksheet_files
        .createMany({
          data: missing.map((id) => ({
            student_id: id,
            exam_id: examId,
            exam_name: exam.exam_name,
            year: exam.exam_year,
            school_id: schoolId,
            status: 'pending',
          })),
          skipDuplicates: true,
        })
        .catch(() => {});
    }

    // Seed the frozen-signatory snapshot while the exam is still open, so a
    // sheet that freezes before it is ever rendered still pins the staff who
    // were assigned during the open window (a later reassignment skips frozen
    // exams and would otherwise never be captured).
    if (!isExamFrozen(exam.result_date)) {
      await this.seedOpenSnapshot(schoolId, eligible, examId, exam.exam_year);
    }

    await this.queue.addBulk(
      eligible.map((id) => ({
        data: {
          studentId: id,
          examId,
          examName: exam.exam_name,
          year: exam.exam_year,
          schoolId,
        },
        opts: { jobId: jobId(schoolId, examId, id), ...defaultJobOpts(priority) },
      })),
    );
  }

  /**
   * Invalidate every student in the given classes for an exam. Class-highest
   * figures print on every sheet, so one student's mark change makes the whole
   * class stale.
   */
  async invalidateClasses(
    schoolId: number,
    examId: number,
    classes: number[],
    year: number,
  ): Promise<void> {
    if (classes.length === 0) return;
    logger.info('[marksheet] invalidate(classes): marks changed', { examId, classes, year });
    const marks = await this.prisma.marks.findMany({
      where: {
        school_id: schoolId,
        exam_id: examId,
        marks: { not: null },
        enrollment: { class: { in: classes }, year },
      },
      distinct: ['enrollment_id'],
      select: { enrollment: { select: { student_id: true } } },
    });
    const studentIds = [
      ...new Set(
        marks.map((m) => m.enrollment?.student_id).filter((id): id is number => id != null),
      ),
    ];
    await this.invalidate(schoolId, studentIds, examId);
  }

  /**
   * Re-queue per-student sheets and class bundles after a class-teacher
   * assignment (levels) or teacher identity change affecting that section.
   */
  async invalidateForClassSection(
    schoolId: number,
    className: number,
    section: string,
    year: number,
  ): Promise<void> {
    logger.info('[marksheet] invalidate(class-section): assignment/signature changed', {
      class: className,
      section,
      year,
    });

    const studentIds = (
      await this.prisma.student_enrollments.findMany({
        where: { school_id: schoolId, class: className, section, year },
        select: { student_id: true },
      })
    ).map((e) => e.student_id);

    const examRows: { exam_id: number; exam_name: string; result_date?: string | null }[] =
      studentIds.length
        ? (
            await this.prisma.marks.findMany({
              where: {
                school_id: schoolId,
                enrollment: { student_id: { in: studentIds }, year },
                marks: { not: null },
              },
              distinct: ['exam_id'],
              select: { exam_id: true, exam: { select: { exam_name: true, result_date: true } } },
            })
          ).map((r) => ({
            exam_id: r.exam_id,
            exam_name: r.exam.exam_name,
            result_date: r.exam.result_date,
          }))
        : await this.prisma.marksheet_bundles.findMany({
            where: {
              school_id: schoolId,
              class: className,
              year,
              section: { in: [section, 'ALL'] },
            },
            distinct: ['exam_id'],
            select: { exam_id: true, exam_name: true },
          });

    for (const row of examRows) {
      if (!row.exam_name) continue;

      // Skip frozen exams: reassigning a class teacher must not regenerate a
      // finalized sheet. The snapshotted signatory keeps it stable, and a
      // same-person signature upload is picked up lazily on next download.
      let resultDate = row.result_date;
      if (resultDate === undefined) {
        resultDate =
          (
            await this.prisma.exams.findUnique({
              where: { id: row.exam_id, school_id: schoolId },
              select: { result_date: true },
            })
          )?.result_date ?? null;
      }
      if (isExamFrozen(resultDate)) continue;

      const examStudentIds = await this.studentIdsWithMarksForExam(
        schoolId,
        row.exam_id,
        studentIds,
      );
      if (examStudentIds.length > 0) {
        await this.invalidate(schoolId, examStudentIds, row.exam_id);
      }
      await this.invalidateBundlesForClassSection(
        schoolId,
        row.exam_id,
        className,
        year,
        section,
        row.exam_name,
      );
    }
  }

  /**
   * Re-queue cached marksheets for a school after a head assignment / identity
   * change. Scoped to exams that are still open (result_date not yet passed):
   * finalized (frozen) marksheets keep the head who signed them, so a routine
   * head change no longer regenerates the school's entire history. A frozen
   * sheet still picks up a same-person signature upload lazily on next download.
   */
  async invalidateForSchoolSignatureChange(schoolId: number): Promise<void> {
    logger.info('[marksheet] invalidate(school): head identity changed', { schoolId });

    const exams = await this.prisma.exams.findMany({
      where: { school_id: schoolId },
      select: { id: true, result_date: true },
    });
    const openExamIds = exams.filter((e) => !isExamFrozen(e.result_date)).map((e) => e.id);

    if (openExamIds.length === 0) {
      logger.info('[marksheet] invalidate(school): all exams frozen, nothing to re-queue', {
        schoolId,
        reason: 'head identity changed',
      });
      return;
    }

    const open = { school_id: schoolId, exam_id: { in: openExamIds } };
    await this.prisma.marksheet_files.updateMany({
      where: { ...open, status: { in: ['ready', 'failed'] } },
      data: { status: 'pending', error: null },
    });

    const pendingStudents = await this.prisma.marksheet_files.findMany({
      where: { ...open, status: 'pending' },
      select: { student_id: true, exam_id: true, exam_name: true, year: true },
    });

    if (pendingStudents.length > 0) {
      await this.queue.addBulk(
        pendingStudents.map((r) => ({
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

    await this.prisma.marksheet_bundles.updateMany({
      where: { ...open, status: { in: ['ready', 'failed'] } },
      data: { status: 'pending', error: null },
    });

    const pendingBundles = await this.prisma.marksheet_bundles.findMany({
      where: { ...open, status: 'pending' },
      select: { exam_id: true, exam_name: true, year: true, class: true, section: true },
    });

    if (pendingBundles.length > 0) {
      await this.queue.addBulk(
        pendingBundles.map((r) => ({
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
  }

  /**
   * Re-queue marksheets for every class-section this teacher is assigned to,
   * plus school-wide sheets if they are the head.
   */
  async invalidateForTeacherProfile(schoolId: number, teacherId: number): Promise<void> {
    const levels = await this.prisma.levels.findMany({
      where: { school_id: schoolId, teacher_id: teacherId },
      select: { class_name: true, section: true, year: true },
    });

    for (const lv of levels) {
      await this.invalidateForClassSection(schoolId, lv.class_name, lv.section, lv.year);
    }

    const isHead = await this.prisma.head_msg.findFirst({
      where: { school_id: schoolId, head_id: teacherId },
      select: { id: true },
    });
    if (isHead) await this.invalidateForSchoolSignatureChange(schoolId);
  }

  /** Session PDFs: serve when fresh, else queue at user priority and wait (fails fast on 'failed'). */
  private async serveSession(
    job: SessionStudentJob | SessionYearJob,
    studentId: number,
    hash: string,
    id: string,
    t0: number,
  ): Promise<{ buffer: Buffer }> {
    const { schoolId, year } = job;
    const tryServeFresh = async () => {
      const fresh = await this.hash.isSessionCacheFresh(schoolId, year, studentId, hash);
      if (!fresh) return null;
      const buf = await getFileBuffer(fresh.r2_key);
      return buf ? { buffer: buf } : null;
    };

    const fresh = await tryServeFresh();
    if (fresh) return fresh;

    await this.prisma.marksheet_sessions.upsert({
      where: marksheetSessionWhere(schoolId, year, studentId),
      create: { school_id: schoolId, year, student_id: studentId, status: 'pending' },
      update: { status: 'pending', error: null, attempts: 0 },
    });
    await enqueueUserPriority(this.queue, job, id).catch(() => {});

    const deadline = Date.now() + SERVE_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const ready = await tryServeFresh();
      if (ready) {
        logger.info('[marksheet] serveSession: worker ready', {
          studentId,
          year,
          ms: Date.now() - t0,
        });
        return ready;
      }
      const row = await this.prisma.marksheet_sessions.findUnique({
        where: marksheetSessionWhere(schoolId, year, studentId),
        select: { status: true, error: true },
      });
      if (row?.status === 'failed') {
        if (row.error?.includes('No marks found')) {
          throw new NotFoundException('No session marks found for this student');
        }
        throw new InternalServerErrorException(row.error ?? 'Session marksheet generation failed');
      }
      await sleep(SERVE_POLL_MS);
    }
    throw new GatewayTimeoutException(
      'Session marksheet generation timed out. Please try again shortly.',
    );
  }

  /** Queue (if needed) and poll until a hash-verified student PDF exists in R2. */
  private async waitForFreshStudentPdf(
    job: StudentJob,
    t0: number,
  ): Promise<{ buffer: Buffer; studentName: string }> {
    const { studentId, examId, examName, year, schoolId } = job;
    const whereStudent = marksheetStudentWhere(schoolId, studentId, examId);

    const tryServeFresh = async () => {
      const row = await this.prisma.marksheet_files.findUnique({
        where: whereStudent,
        select: { status: true, input_hash: true, r2_key: true, student_name: true, error: true },
      });
      if (!(await this.hash.isStudentCacheFresh(schoolId, studentId, examId, year, row))) {
        return null;
      }
      const buf = await getFileBuffer(row!.r2_key!);
      if (!buf) return null;
      return { buffer: buf, studentName: row!.student_name ?? 'student' };
    };

    let fresh = await tryServeFresh();
    if (fresh) {
      logger.info('[marksheet] serve: worker cache fresh', {
        studentId,
        examId,
        bytes: fresh.buffer.length,
        ms: Date.now() - t0,
      });
      return fresh;
    }

    await this.prisma.marksheet_files.upsert({
      where: whereStudent,
      create: {
        student_id: studentId,
        exam_id: examId,
        exam_name: examName,
        year,
        school_id: schoolId,
        status: 'pending',
      },
      update: { status: 'pending', error: null, exam_name: examName },
    });
    await enqueueUserPriority(this.queue, job, jobId(schoolId, examId, studentId)).catch(() => {});

    logger.info('[marksheet] serve: waiting for worker', { studentId, examId });

    const deadline = Date.now() + SERVE_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const row = await this.prisma.marksheet_files.findUnique({
        where: whereStudent,
        select: { status: true, error: true },
      });
      if (row?.status === 'failed') {
        throw new InternalServerErrorException(row.error ?? 'Marksheet generation failed');
      }
      if (row?.status === 'skipped') {
        throw new NotFoundException('No marks found for this student');
      }

      fresh = await tryServeFresh();
      if (fresh) {
        logger.info('[marksheet] serve: worker ready', {
          studentId,
          examId,
          bytes: fresh.buffer.length,
          ms: Date.now() - t0,
        });
        return fresh;
      }
      await sleep(SERVE_POLL_MS);
    }

    throw new GatewayTimeoutException('Marksheet generation timed out. Please try again shortly.');
  }

  /** Queue (if needed) and poll until a hash-verified class bundle exists in R2. */
  private async waitForFreshBundlePdf(job: BundleJob, t0: number): Promise<{ url: string }> {
    const { examId, examName, year, class: cls, schoolId } = job;
    const bundleSection = bundleSectionKey(job.bundleSection);
    const whereKey = marksheetBundleWhere(schoolId, examId, cls, bundleSection);

    const tryServeFresh = async (): Promise<{ url: string } | null> => {
      const row = await this.prisma.marksheet_bundles.findUnique({
        where: whereKey,
        select: { status: true, input_hash: true, r2_key: true, error: true },
      });
      if (!(await this.hash.isBundleCacheFresh(schoolId, examId, cls, year, bundleSection, row))) {
        return null;
      }
      if (!(await headObject(row!.r2_key!))) return null;
      return { url: withCacheBust(await getDownloadUrl(row!.r2_key!), row!.input_hash) };
    };

    let fresh = await tryServeFresh();
    if (fresh) {
      logger.info('[marksheet] serveBundle: worker cache fresh', {
        examId,
        class: cls,
        section: bundleSection,
        ms: Date.now() - t0,
      });
      return fresh;
    }

    await this.prisma.marksheet_bundles.upsert({
      where: whereKey,
      create: {
        exam_id: examId,
        exam_name: examName,
        year,
        class: cls,
        section: bundleSection,
        school_id: schoolId,
        status: 'pending',
      },
      // An explicit download is a fresh intent: clear the automatic-retry
      // budget so a previously capped bundle is attempted again.
      update: { status: 'pending', error: null, exam_name: examName, attempts: 0 },
    });
    await enqueueUserPriority(
      this.queue,
      { ...job, kind: 'bundle', bundleSection },
      bundleJobId(schoolId, examId, cls, bundleSection),
    ).catch(() => {});

    const deadline = Date.now() + SERVE_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const row = await this.prisma.marksheet_bundles.findUnique({
        where: whereKey,
        select: { status: true, error: true },
      });
      if (row?.status === 'failed') {
        throw new InternalServerErrorException(row.error ?? 'Bundle generation failed');
      }
      if (row?.status === 'skipped') {
        throw new NotFoundException('No students found for this class bundle');
      }

      fresh = await tryServeFresh();
      if (fresh) {
        logger.info('[marksheet] serveBundle: worker ready', {
          examId,
          class: cls,
          section: bundleSection,
          ms: Date.now() - t0,
        });
        return fresh;
      }
      await sleep(SERVE_POLL_MS);
    }

    throw new GatewayTimeoutException('Class marksheet generation timed out. Please try again.');
  }

  /** Students with at least one non-null mark for this exam. */
  private async studentIdsWithMarksForExam(
    schoolId: number,
    examId: number,
    studentIds: number[],
  ): Promise<number[]> {
    if (studentIds.length === 0) return [];
    const rows = await this.prisma.marks.findMany({
      where: {
        school_id: schoolId,
        exam_id: examId,
        marks: { not: null },
        enrollment: { student_id: { in: studentIds } },
      },
      distinct: ['enrollment_id'],
      select: { enrollment: { select: { student_id: true } } },
    });
    return [
      ...new Set(
        rows.map((r) => r.enrollment?.student_id).filter((id): id is number => id != null),
      ),
    ];
  }

  /**
   * Re-queue class bundles when marks change for the given students.
   * Upserts ALL + each affected section (+ existing composite keys) to pending
   * and enqueues Bull jobs — same shape as teacher/head bundle invalidation.
   */
  private async enqueueBundlesForStudents(
    schoolId: number,
    examId: number,
    examName: string,
    year: number,
    studentIds: number[],
    priority: number,
  ): Promise<void> {
    if (studentIds.length === 0) return;
    const enrollments = await this.prisma.student_enrollments.findMany({
      where: { school_id: schoolId, student_id: { in: studentIds }, year },
      select: { class: true, section: true },
    });
    const sectionsByClass = new Map<number, Set<string>>();
    for (const e of enrollments) {
      if (e.class == null) continue;
      const set = sectionsByClass.get(e.class) ?? new Set<string>();
      set.add(e.section);
      sectionsByClass.set(e.class, set);
    }
    if (sectionsByClass.size === 0) return;

    const jobs = [];

    for (const [className, sections] of sectionsByClass) {
      const existing = await this.prisma.marksheet_bundles.findMany({
        where: { school_id: schoolId, exam_id: examId, class: className },
        select: { section: true },
      });
      const existingSections = existing.map((r) => r.section);
      const keys = new Set<string>(['ALL', ...existingSections]);
      for (const section of sections) {
        for (const k of bundleSectionsForTeacherChange(section, existingSections)) {
          keys.add(k);
        }
      }

      for (const bundleSection of keys) {
        await this.prisma.marksheet_bundles.upsert({
          where: marksheetBundleWhere(schoolId, examId, className, bundleSection),
          create: {
            exam_id: examId,
            exam_name: examName,
            year,
            class: className,
            section: bundleSection,
            school_id: schoolId,
            status: 'pending',
          },
          update: { status: 'pending', error: null, exam_name: examName, input_hash: null },
        });
        jobs.push({
          data: {
            kind: 'bundle' as const,
            examId,
            examName,
            year,
            class: className,
            schoolId,
            bundleSection,
          },
          opts: {
            jobId: bundleJobId(schoolId, examId, className, bundleSection),
            ...defaultJobOpts(priority),
          },
        });
      }
    }

    if (jobs.length > 0) {
      await this.queue.addBulk(jobs);
      logger.info('[marksheet] enqueue(bundles): mark edit', {
        examId,
        classes: [...sectionsByClass.keys()],
        jobs: jobs.length,
      });
    }
  }

  /**
   * Re-queue session PDFs (per affected student + school-year "all") after
   * marks change. Creates cache rows if missing.
   */
  private async enqueueSessionsForStudents(
    schoolId: number,
    studentIds: number[],
    year: number,
    priority: number,
  ): Promise<void> {
    if (studentIds.length === 0) return;

    const uniqueIds = [...new Set(studentIds)];
    for (const studentId of [SESSION_YEAR_STUDENT_ID, ...uniqueIds]) {
      await this.prisma.marksheet_sessions.upsert({
        where: marksheetSessionWhere(schoolId, year, studentId),
        create: { school_id: schoolId, year, student_id: studentId, status: 'pending' },
        update: { status: 'pending', error: null, input_hash: null },
      });
    }

    await this.queue.addBulk([
      {
        data: { kind: 'session-year' as const, year, schoolId },
        opts: { jobId: sessionYearJobId(schoolId, year), ...defaultJobOpts(priority) },
      },
      ...uniqueIds.map((studentId) => ({
        data: { kind: 'session-student' as const, studentId, year, schoolId },
        opts: {
          jobId: sessionStudentJobId(schoolId, year, studentId),
          ...defaultJobOpts(priority),
        },
      })),
    ]);

    logger.info('[marksheet] enqueue(sessions): mark edit', {
      year,
      schoolId,
      students: uniqueIds.length,
      sessionYear: true,
    });
  }

  /**
   * Seed the signatory snapshot on student rows that don't have one yet, using
   * the CURRENT head and each student's current section class-teacher. Called
   * only for OPEN exams: it captures who was assigned while the exam was still
   * open so that if the exam freezes before a first render, the frozen sheet
   * still pins the open-window staff instead of whoever is current at first render.
   *
   * Only fills rows where snapshot_head_id is null — rendered rows already carry
   * an authoritative snapshot, and a reassignment while still open re-renders and
   * refreshes it, so this must not clobber those.
   */
  private async seedOpenSnapshot(
    schoolId: number,
    studentIds: number[],
    examId: number,
    year: number,
  ): Promise<void> {
    if (studentIds.length === 0) return;

    // Cheap gate on the hot marks-entry path: skip entirely once every row is
    // already seeded/rendered.
    const unseeded = await this.prisma.marksheet_files.findMany({
      where: {
        school_id: schoolId,
        exam_id: examId,
        student_id: { in: studentIds },
        snapshot_head_id: null,
      },
      select: { student_id: true },
    });
    if (unseeded.length === 0) return;
    const unseededIds = unseeded.map((r) => r.student_id);

    const [head, enrollments] = await Promise.all([
      this.prisma.head_msg.findFirst({
        where: { school_id: schoolId },
        orderBy: { updated_at: 'desc' },
        select: { head_id: true, head_role: true },
      }),
      this.prisma.student_enrollments.findMany({
        where: { school_id: schoolId, student_id: { in: unseededIds }, year },
        select: { student_id: true, class: true, section: true },
      }),
    ]);
    const headId = head?.head_id ?? null;
    const headRole = head?.head_role ?? null;

    const classSet = [...new Set(enrollments.map((e) => e.class))];
    const sectionSet = [...new Set(enrollments.map((e) => e.section))];
    const levels = classSet.length
      ? await this.prisma.levels.findMany({
          where: {
            school_id: schoolId,
            class_name: { in: classSet },
            section: { in: sectionSet },
            year,
          },
          select: { class_name: true, section: true, teacher_id: true },
        })
      : [];
    const teacherByKey = new Map(
      levels.map((l) => [`${l.class_name}_${l.section}`, l.teacher_id ?? null]),
    );

    // Group by resolved teacher id so each distinct snapshot value is one write.
    const groups = new Map<number | null, number[]>();
    for (const e of enrollments) {
      const tid = teacherByKey.get(`${e.class}_${e.section}`) ?? null;
      const arr = groups.get(tid) ?? [];
      arr.push(e.student_id);
      groups.set(tid, arr);
    }

    for (const [teacherId, ids] of groups) {
      await this.prisma.marksheet_files.updateMany({
        where: {
          school_id: schoolId,
          exam_id: examId,
          student_id: { in: ids },
          snapshot_head_id: null,
        },
        data: {
          snapshot_head_id: headId,
          snapshot_head_role: headRole,
          snapshot_teacher_id: teacherId,
        },
      });
    }
  }

  /** Re-queue class bundle PDFs affected by a section's teacher change. */
  private async invalidateBundlesForClassSection(
    schoolId: number,
    examId: number,
    className: number,
    year: number,
    section: string,
    examName: string,
  ): Promise<void> {
    const existing = await this.prisma.marksheet_bundles.findMany({
      where: { school_id: schoolId, exam_id: examId, class: className },
      select: { section: true },
    });

    const bundleSections = bundleSectionsForTeacherChange(
      section,
      existing.map((r) => r.section),
    );

    for (const bundleSection of bundleSections) {
      await this.prisma.marksheet_bundles.upsert({
        where: marksheetBundleWhere(schoolId, examId, className, bundleSection),
        create: {
          exam_id: examId,
          exam_name: examName,
          year,
          class: className,
          section: bundleSection,
          school_id: schoolId,
          status: 'pending',
        },
        update: { status: 'pending', error: null, exam_name: examName },
      });
    }

    await this.queue.addBulk(
      bundleSections.map((bundleSection) => ({
        data: {
          kind: 'bundle' as const,
          examId,
          examName,
          year,
          class: className,
          schoolId,
          bundleSection,
        },
        opts: {
          jobId: bundleJobId(schoolId, examId, className, bundleSection),
          ...defaultJobOpts(PRIORITY_BACKFILL),
        },
      })),
    );
  }
}
