import crypto from "crypto";
import { prisma } from "@/config/prisma.js";
import {
  getFileBuffer,
  getDownloadUrl,
  uploadToR2,
  headObject,
  deleteFromR2,
  listKeys,
} from "@/config/r2.js";
import { runWithRlsContext } from "@/config/rlsContextStore.js";
import logger from "@/utils/logger.js";
import { MarksService } from "./marks.service.js";
import {
  marksheetQueue,
  defaultJobOpts,
  jobId,
  bundleJobId,
  PRIORITY_BACKFILL,
  type MarksheetJob,
  type StudentJob,
  type BundleJob,
} from "./marksheet.queue.js";

// The worker has no HTTP user; marksheets are already school-scoped by RLS, so
// an admin-role synthetic user only satisfies the in-code access check.
const WORKER_USER = { role: "admin" as const };

export type BundleServeResult =
  | { kind: "redirect"; url: string }
  | { kind: "buffer"; buffer: Buffer };

export class MarksheetService {
  static r2Key(
    schoolId: number,
    year: number,
    examId: number,
    studentId: number,
  ): string {
    return `${schoolId}/marksheets/${year}/${examId}/${studentId}.pdf`;
  }

  /**
   * Fingerprint of everything that changes the rendered PDF, computed with
   * cheap indexed queries (no render). Lets the worker skip regeneration when
   * an invalidation flipped a sheet whose inputs did not actually change.
   * Note: teacher/head signature *file* swaps are not captured here — those go
   * through explicit invalidation instead.
   */
  static async computeInputHash(
    studentId: number,
    examId: number,
    year: number,
  ): Promise<string> {
    const enrollment = await prisma.student_enrollments.findFirst({
      where: { student_id: studentId, year },
      select: { class: true, section: true, roll: true, fourth_subject_id: true },
    });
    const [markAgg, stats, head] = await Promise.all([
      prisma.marks.aggregate({
        where: { exam_id: examId, enrollment: { student_id: studentId, year } },
        _max: { updated_at: true },
        _count: { _all: true },
      }),
      enrollment
        ? prisma.exam_class_stats.findFirst({
            where: { exam_id: examId, class: enrollment.class, year },
            select: { updated_at: true },
          })
        : Promise.resolve(null),
      prisma.head_msg.findFirst({
        orderBy: { updated_at: "desc" },
        select: { updated_at: true },
      }),
    ]);

    const fingerprint = JSON.stringify({
      n: markAgg._count?._all ?? 0,
      m: markAgg._max?.updated_at ?? null,
      s: stats?.updated_at ?? null,
      h: head?.updated_at ?? null,
      f: enrollment?.fourth_subject_id ?? null,
      r: enrollment?.roll ?? null,
      sec: enrollment?.section ?? null,
    });
    return crypto.createHash("sha256").update(fingerprint).digest("hex");
  }

  /**
   * Return a marksheet PDF for a student, serving the pre-generated R2 copy
   * when it exists and is fresh, otherwise generating inline (and warming the
   * cache). Runs inside the caller's RLS context. Requires no client changes:
   * the caller still gets a buffer synchronously.
   */
  static async serve(
    studentId: number,
    year: number,
    examName: string,
    user: any,
  ): Promise<{ buffer: Buffer; studentName: string }> {
    const t0 = Date.now();
    logger.info("[marksheet] serve: request", {
      studentId,
      examName,
      year,
      role: user?.role,
    });
    const exam = await prisma.exams.findFirst({
      where: { exam_name: examName, exam_year: year },
      select: { id: true, school_id: true },
    });

    // Only school-scoped exams participate in caching (need a stable R2 prefix
    // and a school context for background regeneration).
    if (exam?.school_id) {
      const row = await prisma.marksheet_files.findUnique({
        where: { student_id_exam_id: { student_id: studentId, exam_id: exam.id } },
      });
      if (row?.status === "ready" && row.r2_key) {
        const buf = await getFileBuffer(row.r2_key);
        if (buf) {
          logger.info("[marksheet] serve: cache HIT", {
            studentId,
            examId: exam.id,
            key: row.r2_key,
            bytes: buf.length,
            ms: Date.now() - t0,
          });
          return { buffer: buf, studentName: row.student_name ?? "student" };
        }
        // Row said ready but the object is gone (lifecycle rule, manual delete,
        // bucket wipe). Self-heal: flip pending and regenerate below.
        logger.warn("[marksheet] serve: R2 object MISSING, self-healing", {
          studentId,
          examId: exam.id,
          key: row.r2_key,
        });
        await prisma.marksheet_files
          .update({ where: { id: row.id }, data: { status: "pending", r2_key: null } })
          .catch(() => {});
      } else {
        logger.info("[marksheet] serve: cache MISS, generating inline", {
          studentId,
          examId: exam.id,
          rowStatus: row?.status ?? "none",
        });
      }
    } else {
      logger.info("[marksheet] serve: exam not cacheable, generating inline", {
        studentId,
        examName,
        examFound: !!exam,
        schoolId: exam?.school_id ?? null,
      });
    }

    const { buffer, studentName } = await MarksService.generateMarksheetPDF(
      String(studentId),
      String(year),
      examName,
      user,
    );

    if (exam?.school_id) {
      await this.cache(
        studentId,
        exam.id,
        examName,
        year,
        exam.school_id,
        buffer,
        studentName,
      ).catch((e) =>
        logger.warn("[marksheet] serve: failed to cache after inline generate", {
          studentId,
          examId: exam.id,
          error: e instanceof Error ? e.message : String(e),
        }),
      );
    }

    logger.info("[marksheet] serve: inline generated", {
      studentId,
      examId: exam?.id,
      bytes: buffer.length,
      cached: !!exam?.school_id,
      ms: Date.now() - t0,
    });
    return { buffer, studentName };
  }

  /** Upload a rendered buffer to R2 and mark the row ready. */
  private static async cache(
    studentId: number,
    examId: number,
    examName: string,
    year: number,
    schoolId: number,
    buffer: Buffer,
    studentName: string,
  ): Promise<void> {
    const key = this.r2Key(schoolId, year, examId, studentId);
    await uploadToR2(key, buffer);
    const hash = await this.computeInputHash(studentId, examId, year);
    await prisma.marksheet_files.upsert({
      where: { student_id_exam_id: { student_id: studentId, exam_id: examId } },
      create: {
        student_id: studentId,
        exam_id: examId,
        exam_name: examName,
        year,
        school_id: schoolId,
        status: "ready",
        r2_key: key,
        input_hash: hash,
        student_name: studentName,
        generated_at: new Date(),
      },
      update: {
        status: "ready",
        r2_key: key,
        input_hash: hash,
        student_name: studentName,
        generated_at: new Date(),
        error: null,
      },
    });
  }

  /**
   * Queue pre-generation for every student with marks in an exam. Called on
   * result publish. Idempotent: re-running just re-marks rows pending and
   * re-enqueues (jobId dedups in-flight jobs).
   */
  static async enqueueForExam(
    examId: number,
    schoolId: number | null,
    examName: string,
  ): Promise<{ queued: number }> {
    if (!schoolId) {
      logger.warn("[marksheet] enqueue(exam): skipped, no school_id", { examId });
      return { queued: 0 };
    }

    const marks = await prisma.marks.findMany({
      // Only students with at least one real mark — an enrollment with only
      // null marks would make the renderer throw "No marks found".
      where: { exam_id: examId, marks: { not: null } },
      distinct: ["enrollment_id"],
      select: {
        enrollment: { select: { student_id: true, year: true } },
      },
    });

    const targets = new Map<number, number>(); // studentId -> year
    for (const m of marks) {
      const sid = m.enrollment?.student_id;
      const yr = m.enrollment?.year;
      if (sid != null && yr != null) targets.set(sid, yr);
    }

    if (targets.size === 0) {
      logger.info("[marksheet] enqueue(exam): no students with marks", {
        examId,
      });
      return { queued: 0 };
    }

    const jobs: { data: MarksheetJob; opts: any }[] = [];
    for (const [studentId, yr] of targets) {
      await prisma.marksheet_files.upsert({
        where: { student_id_exam_id: { student_id: studentId, exam_id: examId } },
        create: {
          student_id: studentId,
          exam_id: examId,
          exam_name: examName,
          year: yr,
          school_id: schoolId,
          status: "pending",
        },
        update: { status: "pending", error: null, exam_name: examName },
      });
      jobs.push({
        data: { studentId, examId, examName, year: yr, schoolId },
        opts: { jobId: jobId(examId, studentId), ...defaultJobOpts(PRIORITY_BACKFILL) },
      });
    }

    await marksheetQueue.addBulk(jobs);
    logger.info("[marksheet] enqueue(exam): queued student jobs", {
      examId,
      count: jobs.length,
    });
    return { queued: jobs.length };
  }

  /**
   * Mark the given students' sheets stale and re-enqueue. Used when marks are
   * edited after publish. Creates rows for students that don't have one yet.
   */
  static async invalidate(
    studentIds: number[],
    examId: number,
    priority = PRIORITY_BACKFILL,
  ): Promise<void> {
    if (studentIds.length === 0) return;
    const exam = await prisma.exams.findUnique({
      where: { id: examId },
      select: { school_id: true, exam_name: true, exam_year: true },
    });
    if (!exam?.school_id) return;

    logger.info("[marksheet] invalidate(students): flagging stale + re-queue", {
      examId,
      count: studentIds.length,
    });
    await prisma.marksheet_files.updateMany({
      where: { exam_id: examId, student_id: { in: studentIds } },
      data: { status: "pending", error: null },
    });

    const existing = await prisma.marksheet_files.findMany({
      where: { exam_id: examId, student_id: { in: studentIds } },
      select: { student_id: true },
    });
    const have = new Set(existing.map((r) => r.student_id));
    for (const id of studentIds) {
      if (have.has(id)) continue;
      await prisma.marksheet_files
        .create({
          data: {
            student_id: id,
            exam_id: examId,
            exam_name: exam.exam_name,
            year: exam.exam_year,
            school_id: exam.school_id,
            status: "pending",
          },
        })
        .catch(() => {}); // race with a concurrent create — pending row already exists
    }

    await marksheetQueue.addBulk(
      studentIds.map((id) => ({
        data: {
          studentId: id,
          examId,
          examName: exam.exam_name,
          year: exam.exam_year,
          schoolId: exam.school_id!,
        },
        opts: { jobId: jobId(examId, id), ...defaultJobOpts(priority) },
      })),
    );
  }

  /**
   * Invalidate every student in the given classes for an exam. Class-highest
   * figures print on every sheet, so one student's mark change makes the whole
   * class stale.
   */
  static async invalidateClasses(
    examId: number,
    classes: number[],
    year: number,
  ): Promise<void> {
    if (classes.length === 0) return;
    logger.info("[marksheet] invalidate(classes): marks changed", {
      examId,
      classes,
      year,
    });
    const marks = await prisma.marks.findMany({
      where: {
        exam_id: examId,
        marks: { not: null },
        enrollment: { class: { in: classes }, year },
      },
      distinct: ["enrollment_id"],
      select: { enrollment: { select: { student_id: true } } },
    });
    const studentIds = [
      ...new Set(
        marks
          .map((m) => m.enrollment?.student_id)
          .filter((id): id is number => id != null),
      ),
    ];
    await this.invalidate(studentIds, examId);
    await this.invalidateBundles(examId, classes, year);
  }

  /** Status breakdown for an exam, for admin progress UI. */
  static async statusCounts(examId: number): Promise<any> {
    const [grouped, bundleGrouped] = await Promise.all([
      prisma.marksheet_files.groupBy({
        by: ["status"],
        where: { exam_id: examId },
        _count: { _all: true },
      }),
      prisma.marksheet_bundles.groupBy({
        by: ["status"],
        where: { exam_id: examId },
        _count: { _all: true },
      }),
    ]);
    const tally = (rows: typeof grouped) => {
      const out: any = {
        pending: 0,
        generating: 0,
        ready: 0,
        failed: 0,
        skipped: 0,
        total: 0,
      };
      for (const g of rows) {
        out[g.status] = g._count._all;
        out.total += g._count._all;
      }
      // "done" = nothing left to process (ready + skipped are terminal).
      out.done = out.ready + out.skipped;
      return out;
    };
    const students = tally(grouped);
    return { ...students, bundles: tally(bundleGrouped) };
  }

  /** Queue entrypoint: dispatch to the student or bundle processor. */
  static async processJob(job: MarksheetJob): Promise<void> {
    if (job.kind === "bundle") {
      return this.processBundleJob(job);
    }
    return this.processStudentJob(job);
  }

  /**
   * Process one student job: claim the row, skip if inputs unchanged, else
   * render + upload. Runs OUTSIDE any HTTP request, so it must establish the
   * RLS context itself from the job's schoolId before touching tenant models.
   */
  static async processStudentJob(job: StudentJob): Promise<void> {
    const { studentId, examId, examName, year, schoolId } = job;
    const t0 = Date.now();
    await runWithRlsContext(
      { schoolId, isSuperAdmin: false, inRlsTransaction: false },
      async () => {
        // Atomic claim: only the worker that transitions pending/failed ->
        // generating proceeds. Concurrent duplicates see count 0 and bail.
        const claim = await prisma.marksheet_files.updateMany({
          where: {
            student_id: studentId,
            exam_id: examId,
            status: { in: ["pending", "failed"] },
          },
          data: { status: "generating", attempts: { increment: 1 } },
        });
        if (claim.count === 0) {
          logger.debug("[marksheet] job(student): not claimable, skipping", {
            studentId,
            examId,
          });
          return; // already ready, or owned by another worker
        }
        logger.info("[marksheet] job(student): claimed", { studentId, examId });

        try {
          const hash = await this.computeInputHash(studentId, examId, year);
          const row = await prisma.marksheet_files.findUnique({
            where: {
              student_id_exam_id: { student_id: studentId, exam_id: examId },
            },
            select: { input_hash: true, r2_key: true },
          });
          // Nothing changed and the object is still there — no render needed.
          if (
            row?.input_hash === hash &&
            row.r2_key &&
            (await headObject(row.r2_key))
          ) {
            await prisma.marksheet_files.update({
              where: {
                student_id_exam_id: { student_id: studentId, exam_id: examId },
              },
              data: { status: "ready", error: null },
            });
            logger.info("[marksheet] job(student): SKIP render (inputs unchanged)", {
              studentId,
              examId,
              ms: Date.now() - t0,
            });
            return;
          }

          logger.info("[marksheet] job(student): rendering", {
            studentId,
            examId,
            reason: !row?.input_hash
              ? "first-render"
              : row.input_hash !== hash
                ? "inputs-changed"
                : "r2-missing",
          });
          const { buffer, studentName } =
            await MarksService.generateMarksheetPDF(
              String(studentId),
              String(year),
              examName,
              WORKER_USER,
            );
          const key = this.r2Key(schoolId, year, examId, studentId);
          await uploadToR2(key, buffer);
          await prisma.marksheet_files.update({
            where: {
              student_id_exam_id: { student_id: studentId, exam_id: examId },
            },
            data: {
              status: "ready",
              r2_key: key,
              input_hash: hash,
              student_name: studentName,
              generated_at: new Date(),
              error: null,
            },
          });
          logger.info("[marksheet] job(student): READY", {
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
          const isNoMarks = message.includes("No marks found");
          await prisma.marksheet_files
            .update({
              where: {
                student_id_exam_id: { student_id: studentId, exam_id: examId },
              },
              data: {
                status: isNoMarks ? "skipped" : "failed",
                error: isNoMarks ? null : message,
              },
            })
            .catch(() => {});
          if (isNoMarks) {
            logger.info("[marksheet] job(student): SKIPPED (no marks)", {
              studentId,
              examId,
            });
            return; // swallow — do not retry
          }
          logger.error("[marksheet] job(student): FAILED", {
            studentId,
            examId,
            error: message,
          });
          throw err; // let Bull retry per job attempts
        }
      },
    );
  }

  // ---- Whole-class bundles (one PDF per class+exam) -----------------------

  static r2BundleKey(
    schoolId: number,
    year: number,
    examId: number,
    cls: number,
  ): string {
    // Deliberately NOT under the student reconcile prefix
    // ({school}/marksheets/{year}/{examId}/) so reconcileExam never treats a
    // bundle as an orphan student object.
    return `${schoolId}/marksheets/${year}/bundles/${examId}/class-${cls}.pdf`;
  }

  /** Fingerprint of a class's marks + stats for bundle staleness checks. */
  static async computeBundleHash(
    examId: number,
    cls: number,
    year: number,
  ): Promise<string> {
    const [markAgg, stats, head] = await Promise.all([
      prisma.marks.aggregate({
        where: { exam_id: examId, enrollment: { class: cls, year } },
        _max: { updated_at: true },
        _count: { _all: true },
      }),
      prisma.exam_class_stats.findFirst({
        where: { exam_id: examId, class: cls, year },
        select: { updated_at: true },
      }),
      prisma.head_msg.findFirst({
        orderBy: { updated_at: "desc" },
        select: { updated_at: true },
      }),
    ]);
    const fingerprint = JSON.stringify({
      n: markAgg._count?._all ?? 0,
      m: markAgg._max?.updated_at ?? null,
      s: stats?.updated_at ?? null,
      h: head?.updated_at ?? null,
    });
    return crypto.createHash("sha256").update(fingerprint).digest("hex");
  }

  /**
   * Serve a whole-class bundle. Only the admin full-class view is cached;
   * teachers get a section-filtered subset generated inline (never cached).
   */
  static async serveBundle(
    year: number,
    className: string,
    examName: string,
    user: any,
  ): Promise<BundleServeResult> {
    const cls = Number(className);
    const isAdmin = user?.role === "admin";
    const t0 = Date.now();
    logger.info("[marksheet] serveBundle: request", {
      class: cls,
      examName,
      year,
      role: user?.role,
    });
    const exam = await prisma.exams.findFirst({
      where: { exam_name: examName, exam_year: year },
      select: { id: true, school_id: true },
    });

    const redirectIfCached = async (r2Key: string) => {
      if (!(await headObject(r2Key))) return null;
      const url = await getDownloadUrl(r2Key);
      logger.info("[marksheet] serveBundle: redirect to R2", {
        examId: exam?.id,
        class: cls,
        key: r2Key,
        ms: Date.now() - t0,
      });
      return { kind: "redirect" as const, url };
    };

    if (isAdmin && exam?.school_id) {
      const row = await prisma.marksheet_bundles.findUnique({
        where: {
          exam_id_class_section: { exam_id: exam.id, class: cls, section: "ALL" },
        },
      });
      if (row?.status === "ready" && row.r2_key) {
        const hit = await redirectIfCached(row.r2_key);
        if (hit) return hit;
        logger.warn("[marksheet] serveBundle: R2 object MISSING, self-healing", {
          examId: exam.id,
          class: cls,
          key: row.r2_key,
        });
        await prisma.marksheet_bundles
          .update({ where: { id: row.id }, data: { status: "pending", r2_key: null } })
          .catch(() => {});
      } else {
        logger.info("[marksheet] serveBundle: cache MISS, generating inline", {
          examId: exam.id,
          class: cls,
          rowStatus: row?.status ?? "none",
        });
      }
    } else {
      logger.info("[marksheet] serveBundle: not cached (teacher or no school)", {
        class: cls,
        role: user?.role,
      });
    }

    const buffer = await MarksService.generateBulkExamMarksheetsPDF(
      String(year),
      String(cls),
      examName,
      undefined,
      user,
    );
    logger.info("[marksheet] serveBundle: inline generated", {
      class: cls,
      examId: exam?.id,
      bytes: buffer.length,
      cached: isAdmin && !!exam?.school_id,
      ms: Date.now() - t0,
    });

    if (isAdmin && exam?.school_id) {
      await this.cacheBundle(
        exam.id,
        examName,
        cls,
        year,
        exam.school_id,
        buffer,
      ).catch((e) =>
        logger.warn("Failed to cache bundle after inline generate", {
          examId: exam.id,
          class: cls,
          error: e instanceof Error ? e.message : String(e),
        }),
      );
      const key = this.r2BundleKey(exam.school_id, year, exam.id, cls);
      const hit = await redirectIfCached(key);
      if (hit) return hit;
    }
    return { kind: "buffer", buffer };
  }

  private static async cacheBundle(
    examId: number,
    examName: string,
    cls: number,
    year: number,
    schoolId: number,
    buffer: Buffer,
  ): Promise<void> {
    const key = this.r2BundleKey(schoolId, year, examId, cls);
    await uploadToR2(key, buffer);
    const hash = await this.computeBundleHash(examId, cls, year);
    await prisma.marksheet_bundles.upsert({
      where: {
        exam_id_class_section: { exam_id: examId, class: cls, section: "ALL" },
      },
      create: {
        exam_id: examId,
        exam_name: examName,
        year,
        class: cls,
        section: "ALL",
        school_id: schoolId,
        status: "ready",
        r2_key: key,
        input_hash: hash,
        generated_at: new Date(),
      },
      update: {
        status: "ready",
        r2_key: key,
        input_hash: hash,
        generated_at: new Date(),
        error: null,
      },
    });
  }

  /** Queue one bundle per class that has marks in the exam. */
  static async enqueueBundlesForExam(
    examId: number,
    schoolId: number | null,
    examName: string,
  ): Promise<{ queued: number }> {
    if (!schoolId) return { queued: 0 };
    const marks = await prisma.marks.findMany({
      where: { exam_id: examId, marks: { not: null } },
      distinct: ["enrollment_id"],
      select: { enrollment: { select: { class: true, year: true } } },
    });
    const classes = new Map<number, number>(); // class -> year
    for (const m of marks) {
      const c = m.enrollment?.class;
      const y = m.enrollment?.year;
      if (c != null && y != null) classes.set(c, y);
    }
    if (classes.size === 0) return { queued: 0 };

    const jobs: { data: BundleJob; opts: any }[] = [];
    for (const [cls, yr] of classes) {
      await prisma.marksheet_bundles.upsert({
        where: {
          exam_id_class_section: { exam_id: examId, class: cls, section: "ALL" },
        },
        create: {
          exam_id: examId,
          exam_name: examName,
          year: yr,
          class: cls,
          section: "ALL",
          school_id: schoolId,
          status: "pending",
        },
        update: { status: "pending", error: null, exam_name: examName },
      });
      jobs.push({
        data: { kind: "bundle", examId, examName, year: yr, class: cls, schoolId },
        opts: { jobId: bundleJobId(examId, cls), ...defaultJobOpts(PRIORITY_BACKFILL) },
      });
    }
    await marksheetQueue.addBulk(jobs);
    logger.info("[marksheet] enqueue(bundles): queued bundle jobs", {
      examId,
      count: jobs.length,
    });
    return { queued: jobs.length };
  }

  /** Mark class bundles stale and re-enqueue. */
  static async invalidateBundles(
    examId: number,
    classes: number[],
    year: number,
  ): Promise<void> {
    if (classes.length === 0) return;
    const exam = await prisma.exams.findUnique({
      where: { id: examId },
      select: { school_id: true, exam_name: true },
    });
    if (!exam?.school_id) return;

    await prisma.marksheet_bundles.updateMany({
      where: { exam_id: examId, class: { in: classes }, section: "ALL" },
      data: { status: "pending", error: null },
    });
    const existing = await prisma.marksheet_bundles.findMany({
      where: { exam_id: examId, class: { in: classes }, section: "ALL" },
      select: { class: true },
    });
    const have = new Set(existing.map((r) => r.class));
    for (const cls of classes) {
      if (have.has(cls)) continue;
      await prisma.marksheet_bundles
        .create({
          data: {
            exam_id: examId,
            exam_name: exam.exam_name,
            year,
            class: cls,
            section: "ALL",
            school_id: exam.school_id,
            status: "pending",
          },
        })
        .catch(() => {});
    }
    await marksheetQueue.addBulk(
      classes.map((cls) => ({
        data: {
          kind: "bundle" as const,
          examId,
          examName: exam.exam_name,
          year,
          class: cls,
          schoolId: exam.school_id!,
        },
        opts: { jobId: bundleJobId(examId, cls), ...defaultJobOpts(PRIORITY_BACKFILL) },
      })),
    );
  }

  static async processBundleJob(job: BundleJob): Promise<void> {
    const { examId, examName, year, class: cls, schoolId } = job;
    const t0 = Date.now();
    await runWithRlsContext(
      { schoolId, isSuperAdmin: false, inRlsTransaction: false },
      async () => {
        const claim = await prisma.marksheet_bundles.updateMany({
          where: {
            exam_id: examId,
            class: cls,
            section: "ALL",
            status: { in: ["pending", "failed"] },
          },
          data: { status: "generating", attempts: { increment: 1 } },
        });
        if (claim.count === 0) {
          logger.debug("[marksheet] job(bundle): not claimable, skipping", {
            examId,
            class: cls,
          });
          return;
        }
        logger.info("[marksheet] job(bundle): claimed", { examId, class: cls });

        const whereKey = {
          exam_id_class_section: { exam_id: examId, class: cls, section: "ALL" },
        };
        try {
          const hash = await this.computeBundleHash(examId, cls, year);
          const row = await prisma.marksheet_bundles.findUnique({
            where: whereKey,
            select: { input_hash: true, r2_key: true },
          });
          if (
            row?.input_hash === hash &&
            row.r2_key &&
            (await headObject(row.r2_key))
          ) {
            await prisma.marksheet_bundles.update({
              where: whereKey,
              data: { status: "ready", error: null },
            });
            logger.info("[marksheet] job(bundle): SKIP render (inputs unchanged)", {
              examId,
              class: cls,
              ms: Date.now() - t0,
            });
            return;
          }

          logger.info("[marksheet] job(bundle): rendering", { examId, class: cls });
          const buffer = await MarksService.generateBulkExamMarksheetsPDF(
            String(year),
            String(cls),
            examName,
            undefined,
            WORKER_USER,
          );
          const key = this.r2BundleKey(schoolId, year, examId, cls);
          await uploadToR2(key, buffer);
          await prisma.marksheet_bundles.update({
            where: whereKey,
            data: {
              status: "ready",
              r2_key: key,
              input_hash: hash,
              generated_at: new Date(),
              error: null,
            },
          });
          logger.info("[marksheet] job(bundle): READY", {
            examId,
            class: cls,
            key,
            bytes: buffer.length,
            ms: Date.now() - t0,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const isEmpty = message.includes("No students found");
          await prisma.marksheet_bundles
            .update({
              where: whereKey,
              data: {
                status: isEmpty ? "skipped" : "failed",
                error: isEmpty ? null : message,
              },
            })
            .catch(() => {});
          if (isEmpty) {
            logger.info("[marksheet] job(bundle): SKIPPED (no students)", {
              examId,
              class: cls,
            });
            return;
          }
          logger.error("[marksheet] job(bundle): FAILED", {
            examId,
            class: cls,
            error: message,
          });
          throw err;
        }
      },
    );
  }

  /**
   * Startup recovery: reset sheets stuck in `generating` (worker died mid-job)
   * and re-enqueue everything still pending. Safe to run on every boot.
   */
  static async recover(): Promise<void> {
    await Promise.all([
      prisma.marksheet_files.updateMany({
        where: { status: "generating" },
        data: { status: "pending" },
      }),
      prisma.marksheet_bundles.updateMany({
        where: { status: "generating" },
        data: { status: "pending" },
      }),
    ]);
    const [pending, pendingBundles] = await Promise.all([
      prisma.marksheet_files.findMany({
        where: { status: "pending" },
        select: {
          student_id: true,
          exam_id: true,
          exam_name: true,
          year: true,
          school_id: true,
        },
      }),
      prisma.marksheet_bundles.findMany({
        where: { status: "pending" },
        select: {
          exam_id: true,
          exam_name: true,
          year: true,
          class: true,
          school_id: true,
        },
      }),
    ]);
    if (pending.length > 0) {
      await marksheetQueue.addBulk(
        pending.map((r) => ({
          data: {
            studentId: r.student_id,
            examId: r.exam_id,
            examName: r.exam_name,
            year: r.year,
            schoolId: r.school_id,
          },
          opts: {
            jobId: jobId(r.exam_id, r.student_id),
            ...defaultJobOpts(PRIORITY_BACKFILL),
          },
        })),
      );
    }
    if (pendingBundles.length > 0) {
      await marksheetQueue.addBulk(
        pendingBundles.map((r) => ({
          data: {
            kind: "bundle" as const,
            examId: r.exam_id,
            examName: r.exam_name,
            year: r.year,
            class: r.class,
            schoolId: r.school_id,
          },
          opts: {
            jobId: bundleJobId(r.exam_id, r.class),
            ...defaultJobOpts(PRIORITY_BACKFILL),
          },
        })),
      );
    }
    logger.info("[marksheet] recover: re-enqueued pending on startup", {
      students: pending.length,
      bundles: pendingBundles.length,
    });
  }

  /**
   * Reconcile the DB against R2 for one exam: regenerate rows whose object
   * vanished, delete orphan objects with no ready row. For a nightly cron.
   */
  static async reconcileExam(
    examId: number,
    schoolId: number,
    year: number,
  ): Promise<{ regenerated: number; orphansDeleted: number }> {
    const prefix = `${schoolId}/marksheets/${year}/${examId}/`;
    const [rows, keys] = await Promise.all([
      prisma.marksheet_files.findMany({
        where: { exam_id: examId, status: "ready" },
        select: { student_id: true, r2_key: true },
      }),
      listKeys(prefix),
    ]);
    const keySet = new Set(keys);
    const validKeys = new Set<string>();

    let regenerated = 0;
    const stale: number[] = [];
    for (const r of rows) {
      const expected = this.r2Key(schoolId, year, examId, r.student_id);
      validKeys.add(expected);
      if (!r.r2_key || !keySet.has(r.r2_key)) stale.push(r.student_id);
    }
    if (stale.length > 0) {
      await this.invalidate(stale, examId);
      regenerated = stale.length;
    }

    let orphansDeleted = 0;
    for (const key of keys) {
      if (!validKeys.has(key)) {
        await deleteFromR2(key);
        orphansDeleted++;
      }
    }
    return { regenerated, orphansDeleted };
  }
}
