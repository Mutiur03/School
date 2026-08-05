import crypto from "crypto";
import fs from "fs";
import PDFDocument from "pdfkit";
import { prisma } from "@/config/prisma.js";
import {
  getFileBuffer,
  headObject,
  uploadToR2,
} from "@/config/r2.js";
import { getRlsContext, runWithRlsContext } from "@/config/rlsContextStore.js";
import { ApiError } from "@/utils/ApiError.js";
import logger from "@/utils/logger.js";
import { SchoolService } from "../school/school.service.js";
import {
  attendanceSheetJobId,
  attendanceSheetQueue,
  defaultJobOpts,
  enqueueUserPriority,
  ensureJobQueued,
  PRIORITY_BACKFILL,
  PRIORITY_USER,
  type AttendanceSheetJob,
} from "./attendence-sheet.queue.js";

/** Bump to force regen of all cached attendance sheets. */
export const ATTENDANCE_SHEET_DESIGN_VERSION = "28";

/**
 * A month is "ended" once Asia/Dhaka calendar has moved past it. Ended-month
 * sheets pin the class teacher (and design version) so a later reassignment
 * does not regenerate them — same idea as marksheets after result_date.
 */
export function isAttendanceMonthEnded(year: number, month: number): boolean {
  const nowBd = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" }),
  );
  const y = nowBd.getFullYear();
  const m = nowBd.getMonth() + 1;
  return year < y || (year === y && month < m);
}

/**
 * Design field for input hashes. Always the live design version so layout
 * bumps invalidate cache. Ended months still pin teacher via snapshot_* only.
 */
function designFingerprint(
  _ended: boolean,
  _snapshotVersion: string | null | undefined,
): { d: string } {
  return { d: ATTENDANCE_SHEET_DESIGN_VERSION };
}

const STUDENTS_PER_PAGE = 40;
const SERVE_TIMEOUT_MS = Number(
  process.env.ATTENDANCE_SHEET_SERVE_TIMEOUT_MS || "120000",
);
const SERVE_POLL_MS = Number(
  process.env.ATTENDANCE_SHEET_SERVE_POLL_MS || "500",
);
/** true = render PDF in the request; false = Bull queue + poll (default). */
export const ATTENDANCE_SHEET_INLINE = process.env.NODE_ENV !== "production" || true;
const FONT_REGULAR = "Times-Roman";
const FONT_BOLD = "Times-Bold";
const TIMES_FONT_PATHS = {
  regular: [
    process.env.MARKSHEET_FONT_REGULAR,
    "C:\\Windows\\Fonts\\times.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSerif-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
  ].filter(Boolean) as string[],
  bold: [
    process.env.MARKSHEET_FONT_BOLD,
    "C:\\Windows\\Fonts\\timesbd.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSerif-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
  ].filter(Boolean) as string[],
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const CLASS_NAMES: Record<string, string> = {
  "6": "Six",
  "7": "Seven",
  "8": "Eight",
  "9": "Nine",
  "10": "Ten",
};

type StudentRow = {
  studentId: number;
  roll: number | null;
  name: string;
  available: boolean;
  /** day (1–31) → status */
  days: Record<number, string>;
};

type SheetServeResult = { buffer: Buffer; filename: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Prefer full URL for PDF header (customDomain or website). */
function formatSchoolWebsiteUrl(raw?: string | null): string | null {
  const s = raw?.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s.replace(/\/+$/, "");
  return `https://${s.replace(/\/+$/, "")}`;
}
function registerFonts(doc: PDFKit.PDFDocument) {
  const regular = TIMES_FONT_PATHS.regular.find((p) => fs.existsSync(p));
  const bold = TIMES_FONT_PATHS.bold.find((p) => fs.existsSync(p));
  if (regular) doc.registerFont(FONT_REGULAR, regular);
  if (bold) doc.registerFont(FONT_BOLD, bold);
}

function statusMark(status: string | undefined): string {
  if (!status) return "";
  const s = status.trim().toLowerCase();
  if (s === "present") return "P";
  if (s === "absent") return "A";
  // Sheet only shows P/A; run-away counts and displays as present.
  if (s === "run-awayed" || s === "runaway" || s === "run-away") return "P";
  return "";
}

function isoStamp(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

export class AttendanceSheetService {
  static r2Key(
    schoolId: number,
    year: number,
    month: number,
    cls: number,
    section: string,
  ): string {
    const mm = String(month).padStart(2, "0");
    return `${schoolId}/attendance/${year}/${mm}/class-${cls}-${section}.pdf`;
  }

  private static assertTeacherAccess(
    user: any,
    cls: number,
    year: number,
    section: string,
  ): void {
    if (user?.role !== "teacher") return;
    const assigned = (user.levels ?? [])
      .filter((l: any) => l.class_name === cls && l.year === year)
      .map((l: any) => l.section)
      .filter(Boolean) as string[];
    if (assigned.length === 0) {
      throw new ApiError(403, "You are not assigned to this class.");
    }
    if (!assigned.includes(section)) {
      throw new ApiError(403, "You are not assigned to this section.");
    }
  }

  /** Fingerprint of everything that changes the rendered PDF. */
  static async computeInputHash(
    year: number,
    month: number,
    cls: number,
    section: string,
  ): Promise<string> {
    const mm = String(month).padStart(2, "0");
    const start = `${year}-${mm}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`;
    const ended = isAttendanceMonthEnded(year, month);

    const [enrollments, attendance, school, level, sheet] = await Promise.all([
      prisma.student_enrollments.findMany({
        where: { class: cls, section, year },
        select: {
          student_id: true,
          roll: true,
          student: { select: { name: true, available: true } },
        },
        orderBy: [{ roll: "asc" }, { student_id: "asc" }],
      }),
      prisma.attendence.findMany({
        where: {
          date: { gte: start, lte: end },
          student: {
            enrollments: { some: { class: cls, section, year } },
          },
        },
        select: { student_id: true, date: true, status: true },
        orderBy: [{ student_id: "asc" }, { date: "asc" }],
      }),
      prisma.school.findFirst({
        select: {
          name: true,
          eiin: true,
          address: true,
          location: true,
          district: true,
          upazila: true,
          phone: true,
          website: true,
          customDomain: true,
          updatedAt: true,
        },
      }),
      prisma.levels.findFirst({
        where: { class_name: cls, section, year },
        select: {
          teacher_id: true,
          teacher: { select: { name: true } },
        },
      }),
      prisma.attendance_sheets.findFirst({
        where: { year, month, class: cls, section },
        select: {
          design_version: true,
          snapshot_teacher_id: true,
          snapshot_teacher_name: true,
        },
      }),
    ]);

    // Ended months use the pinned teacher; open months stay live.
    // Legacy ended rows with no snapshot yet omit teacher so a reassignment
    // cannot force regen (snapshot is seeded on next generate / boot pin).
    let teacher:
      | { id: number | null; n: string | null }
      | undefined;
    if (!ended) {
      teacher = {
        id: level?.teacher_id ?? null,
        n: level?.teacher?.name ?? null,
      };
    } else if (sheet?.snapshot_teacher_id != null) {
      teacher = {
        id: sheet.snapshot_teacher_id,
        n: sheet.snapshot_teacher_name ?? null,
      };
    }

    const fingerprint = JSON.stringify({
      ...designFingerprint(ended, sheet?.design_version),
      e: enrollments.map((r) => [
        r.student_id,
        r.roll,
        r.student?.name ?? null,
        r.student?.available ?? null,
      ]),
      a: attendance.map((r) => [r.student_id, r.date, r.status]),
      school: {
        n: school?.name ?? null,
        e: school?.eiin ?? null,
        a: school?.address ?? null,
        l: school?.location ?? null,
        di: school?.district ?? null,
        u: school?.upazila ?? null,
        p: school?.phone ?? null,
        w: school?.customDomain?.trim() || school?.website?.trim() || null,
        t: isoStamp(school?.updatedAt),
      },
      ...(teacher ? { teacher } : {}),
    });
    return crypto.createHash("sha256").update(fingerprint).digest("hex");
  }

  private static async isCacheFresh(
    year: number,
    month: number,
    cls: number,
    section: string,
    row: {
      status: string;
      input_hash: string | null;
      r2_key: string | null;
    } | null,
  ): Promise<boolean> {
    if (!row || row.status !== "ready" || !row.r2_key || !row.input_hash) {
      return false;
    }
    const hash = await this.computeInputHash(year, month, cls, section);
    if (row.input_hash !== hash) return false;
    return !!(await headObject(row.r2_key));
  }

  /**
   * Mark sheet stale and re-enqueue after attendance changes.
   * month is 1–12.
   */
  static async invalidate(
    year: number,
    month: number,
    cls: number,
    section: string,
    schoolId?: number | null,
  ): Promise<void> {
    const ctxSchoolId = schoolId ?? getRlsContext()?.schoolId;
    if (!ctxSchoolId) {
      logger.warn("[attendance-sheet] invalidate: no schoolId", {
        year,
        month,
        class: cls,
        section,
      });
      return;
    }

    logger.info("[attendance-sheet] invalidate: flagging stale + re-queue", {
      year,
      month,
      class: cls,
      section,
    });

    await prisma.attendance_sheets.upsert({
      where: {
        attendance_sheet_scope: {
          school_id: ctxSchoolId,
          year,
          month,
          class: cls,
          section,
        },
      },
      create: {
        school_id: ctxSchoolId,
        year,
        month,
        class: cls,
        section,
        status: "pending",
      },
      update: { status: "pending", error: null },
    });

    await ensureJobQueued(
      {
        schoolId: ctxSchoolId,
        year,
        month,
        class: cls,
        section,
      },
      attendanceSheetJobId(ctxSchoolId, year, month, cls, section),
      PRIORITY_BACKFILL,
    );
  }

  /**
   * Invalidate from a batch of saved attendance records (may span dates).
   * Resolves class/section/year from enrollments when not provided.
   */
  static async invalidateFromRecords(
    records: { studentId: number; date: string }[],
    hint?: { level?: number; section?: string; year?: number },
  ): Promise<void> {
    if (records.length === 0 && !hint?.level) return;

    const schoolId = getRlsContext()?.schoolId;
    if (!schoolId) return;

    const scopes = new Map<
      string,
      { year: number; month: number; class: number; section: string }
    >();

    if (
      hint?.level != null &&
      hint.section &&
      hint.year != null &&
      records.length > 0
    ) {
      for (const r of records) {
        const m = /^(\d{4})-(\d{2})-/.exec(r.date);
        if (!m) continue;
        const year = parseInt(m[1], 10);
        const month = parseInt(m[2], 10);
        const key = `${year}|${month}|${hint.level}|${hint.section}`;
        scopes.set(key, {
          year,
          month,
          class: hint.level,
          section: hint.section,
        });
      }
    } else if (records.length > 0) {
      const studentIds = [...new Set(records.map((r) => r.studentId))];
      const years = [
        ...new Set(
          records
            .map((r) => parseInt(r.date.slice(0, 4), 10))
            .filter(Number.isFinite),
        ),
      ];
      const enrollments = await prisma.student_enrollments.findMany({
        where: {
          student_id: { in: studentIds },
          year: { in: years },
        },
        select: {
          student_id: true,
          year: true,
          class: true,
          section: true,
        },
      });
      const byStudentYear = new Map(
        enrollments.map((e) => [`${e.student_id}|${e.year}`, e]),
      );
      for (const r of records) {
        const year = parseInt(r.date.slice(0, 4), 10);
        const month = parseInt(r.date.slice(5, 7), 10);
        if (!Number.isFinite(year) || !Number.isFinite(month)) continue;
        const enr = byStudentYear.get(`${r.studentId}|${year}`);
        if (!enr) continue;
        const key = `${year}|${month}|${enr.class}|${enr.section}`;
        scopes.set(key, {
          year,
          month,
          class: enr.class,
          section: enr.section,
        });
      }
    }

    for (const scope of scopes.values()) {
      await this.invalidate(
        scope.year,
        scope.month,
        scope.class,
        scope.section,
        schoolId,
      );
    }
  }

  /** Re-queue pending/failed rows after restart. */
  static async recover(): Promise<void> {
    const schools = await prisma.school.findMany({ select: { id: true } });
    let totalRows = 0;
    let queued = 0;

    for (const { id: schoolId } of schools) {
      const counts = await runWithRlsContext(
        { schoolId, isSuperAdmin: false, inRlsTransaction: false },
        async () => {
          await prisma.attendance_sheets.updateMany({
            where: {
              school_id: schoolId,
              status: { in: ["generating", "failed"] },
            },
            data: { status: "pending", error: null },
          });

          const rows = await prisma.attendance_sheets.findMany({
            where: {
              school_id: schoolId,
              status: "pending",
            },
            select: {
              year: true,
              month: true,
              class: true,
              section: true,
            },
          });

          let added = 0;
          for (const row of rows) {
            const ok = await ensureJobQueued(
              {
                schoolId,
                year: row.year,
                month: row.month,
                class: row.class,
                section: row.section,
              },
              attendanceSheetJobId(
                schoolId,
                row.year,
                row.month,
                row.class,
                row.section,
              ),
            );
            if (ok) added++;
          }
          return { rows: rows.length, added };
        },
      );
      totalRows += counts.rows;
      queued += counts.added;
    }

    if (totalRows === 0) return;
    logger.info("[attendance-sheet] recover: re-queued pending/failed", {
      rows: totalRows,
      queued,
      schools: schools.length,
    });
  }

  /**
   * On deploy/boot: enqueue sheets whose design_version is behind, but only for
   * months that have not ended yet. Past months regenerate on attendance
   * submission (or next download), not on every boot.
   */
  static async applyDesignVersionBumpIfNeeded(): Promise<void> {
    // School timezone — month boundary for "month ended".
    const nowBd = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" }),
    );
    const openYear = nowBd.getFullYear();
    const openMonth = nowBd.getMonth() + 1; // 1–12

    const schools = await prisma.school.findMany({ select: { id: true } });
    let outdated = 0;
    let queued = 0;
    let skippedPast = 0;

    for (const { id: schoolId } of schools) {
      const counts = await runWithRlsContext(
        { schoolId, isSuperAdmin: false, inRlsTransaction: false },
        async () => {
          const rows = await prisma.attendance_sheets.findMany({
            where: {
              school_id: schoolId,
              OR: [
                { design_version: null },
                { design_version: { not: ATTENDANCE_SHEET_DESIGN_VERSION } },
              ],
              status: { in: ["ready", "failed", "pending"] },
            },
            select: {
              year: true,
              month: true,
              class: true,
              section: true,
            },
          });

          const openRows = rows.filter(
            (r) => !isAttendanceMonthEnded(r.year, r.month),
          );
          const past = rows.length - openRows.length;
          if (openRows.length === 0) {
            return { outdated: 0, added: 0, past };
          }

          let added = 0;
          for (const row of openRows) {
            await prisma.attendance_sheets.updateMany({
              where: {
                school_id: schoolId,
                year: row.year,
                month: row.month,
                class: row.class,
                section: row.section,
              },
              data: { status: "pending", error: null },
            });
            const ok = await ensureJobQueued(
              {
                schoolId,
                year: row.year,
                month: row.month,
                class: row.class,
                section: row.section,
              },
              attendanceSheetJobId(
                schoolId,
                row.year,
                row.month,
                row.class,
                row.section,
              ),
              PRIORITY_BACKFILL,
            );
            if (ok) added++;
          }
          return { outdated: openRows.length, added, past };
        },
      );
      outdated += counts.outdated;
      queued += counts.added;
      skippedPast += counts.past;
    }

    if (outdated === 0 && skippedPast === 0) {
      logger.info("[attendance-sheet] design bump: all open caches current", {
        version: ATTENDANCE_SHEET_DESIGN_VERSION,
        openAsOf: `${openYear}-${String(openMonth).padStart(2, "0")}`,
      });
      return;
    }

    logger.info("[attendance-sheet] design bump: enqueued open-month caches", {
      version: ATTENDANCE_SHEET_DESIGN_VERSION,
      openAsOf: `${openYear}-${String(openMonth).padStart(2, "0")}`,
      outdated,
      queued,
      skippedPast,
      schools: schools.length,
    });
  }

  /**
   * On startup: discover every (year, month, class, section) that has attendance
   * and enqueue a sheet job when no ready/generating cache exists. Covers past
   * years and ended months — first deploy fills history without waiting for
   * each download.
   */
  static async enqueueMissingHistorySheets(): Promise<void> {
    const schools = await prisma.school.findMany({ select: { id: true } });
    let scopes = 0;
    let created = 0;
    let queued = 0;

    for (const { id: schoolId } of schools) {
      const counts = await runWithRlsContext(
        { schoolId, isSuperAdmin: false, inRlsTransaction: false },
        async () => {
          const discovered = await prisma.$queryRaw<
            Array<{
              year: number | bigint;
              month: number | bigint;
              class: number | bigint;
              section: string;
            }>
          >`
            SELECT DISTINCT
              e.year AS year,
              CAST(SUBSTRING(a.date FROM 6 FOR 2) AS INTEGER) AS month,
              e.class AS class,
              TRIM(BOTH FROM e.section::text) AS section
            FROM attendence a
            INNER JOIN student_enrollments e
              ON e.student_id = a.student_id
             AND e.school_id = a.school_id
             AND e.year = CAST(SUBSTRING(a.date FROM 1 FOR 4) AS INTEGER)
            WHERE a.school_id = ${schoolId}
              AND LENGTH(a.date) >= 7
              AND SUBSTRING(a.date FROM 6 FOR 2) ~ '^[0-9]{2}$'
          `;

          if (discovered.length === 0) {
            return { scopes: 0, created: 0, queued: 0 };
          }

          const existing = await prisma.attendance_sheets.findMany({
            where: { school_id: schoolId },
            select: {
              year: true,
              month: true,
              class: true,
              section: true,
              status: true,
            },
          });
          const byKey = new Map(
            existing.map((r) => [
              `${r.year}|${r.month}|${r.class}|${r.section.trim()}`,
              r.status,
            ]),
          );

          let made = 0;
          let added = 0;
          for (const raw of discovered) {
            const year = Number(raw.year);
            const month = Number(raw.month);
            const cls = Number(raw.class);
            const section = String(raw.section ?? "").trim();
            if (
              !Number.isFinite(year) ||
              !Number.isFinite(month) ||
              month < 1 ||
              month > 12 ||
              !Number.isFinite(cls) ||
              !section
            ) {
              continue;
            }

            const key = `${year}|${month}|${cls}|${section}`;
            const status = byKey.get(key);
            if (status === "ready" || status === "generating") continue;

            await prisma.attendance_sheets.upsert({
              where: {
                attendance_sheet_scope: {
                  school_id: schoolId,
                  year,
                  month,
                  class: cls,
                  section,
                },
              },
              create: {
                school_id: schoolId,
                year,
                month,
                class: cls,
                section,
                status: "pending",
              },
              update: { status: "pending", error: null },
            });
            if (!status) made++;

            const ok = await ensureJobQueued(
              {
                schoolId,
                year,
                month,
                class: cls,
                section,
              },
              attendanceSheetJobId(schoolId, year, month, cls, section),
              PRIORITY_BACKFILL,
            );
            if (ok) added++;
          }

          return {
            scopes: discovered.length,
            created: made,
            queued: added,
          };
        },
      );
      scopes += counts.scopes;
      created += counts.created;
      queued += counts.queued;
    }

    if (scopes === 0 && created === 0) return;
    logger.info("[attendance-sheet] history backfill: enqueued missing sheets", {
      scopes,
      created,
      queued,
      schools: schools.length,
    });
  }

  /**
   * Stabilize ended-month ready caches after deploy: rewrite `input_hash` to the
   * current fingerprint (teacher omitted until a real snapshot exists) without
   * regenerating the PDF or stamping the live class teacher. That keeps the
   * existing PDF served and stops reassignment from forcing a false regen.
   */
  static async pinEndedMonthSnapshots(): Promise<void> {
    const schools = await prisma.school.findMany({ select: { id: true } });
    let stabilized = 0;

    for (const { id: schoolId } of schools) {
      const n = await runWithRlsContext(
        { schoolId, isSuperAdmin: false, inRlsTransaction: false },
        async () => {
          const rows = await prisma.attendance_sheets.findMany({
            where: {
              school_id: schoolId,
              status: "ready",
              snapshot_teacher_id: null,
            },
            select: {
              year: true,
              month: true,
              class: true,
              section: true,
              design_version: true,
              input_hash: true,
            },
          });

          const ended = rows.filter((r) =>
            isAttendanceMonthEnded(r.year, r.month),
          );
          let count = 0;
          for (const row of ended) {
            const design =
              row.design_version ?? ATTENDANCE_SHEET_DESIGN_VERSION;
            if (!row.design_version) {
              await prisma.attendance_sheets.updateMany({
                where: {
                  school_id: schoolId,
                  year: row.year,
                  month: row.month,
                  class: row.class,
                  section: row.section,
                },
                data: { design_version: design },
              });
            }
            const hash = await this.computeInputHash(
              row.year,
              row.month,
              row.class,
              row.section,
            );
            if (row.input_hash === hash) continue;
            await prisma.attendance_sheets.updateMany({
              where: {
                school_id: schoolId,
                year: row.year,
                month: row.month,
                class: row.class,
                section: row.section,
              },
              data: { input_hash: hash },
            });
            count++;
          }
          return count;
        },
      );
      stabilized += n;
    }

    if (stabilized > 0) {
      logger.info(
        "[attendance-sheet] stabilized ended-month hashes (no PDF regen)",
        { stabilized, schools: schools.length },
      );
    }
  }

  /**
   * Re-enqueue after the current Bull job finishes. Same jobId cannot be added
   * while a handler is still active.
   */
  private static deferRequeue(job: AttendanceSheetJob): void {
    setImmediate(() => {
      attendanceSheetQueue
        .add(job, {
          jobId: attendanceSheetJobId(
            job.schoolId,
            job.year,
            job.month,
            job.class,
            job.section,
          ),
          ...defaultJobOpts(PRIORITY_BACKFILL),
        })
        .catch((e) =>
          logger.warn("[attendance-sheet] requeue failed", {
            year: job.year,
            month: job.month,
            class: job.class,
            section: job.section,
            error: e instanceof Error ? e.message : String(e),
          }),
        );
    });
  }

  /**
   * Serve monthly attendance sheet via worker + hash-verified R2 cache.
   * month is 1–12.
   * Set ATTENDANCE_SHEET_INLINE=true (or pass inline: true) to render in-request
   * on every download (still updates DB + R2). Queue mode serves cache when fresh.
   */
  static async serve(
    year: number,
    month: number,
    cls: number,
    section: string,
    user: any,
    opts?: { inline?: boolean },
  ): Promise<SheetServeResult> {
    if (
      !Number.isFinite(year) ||
      !Number.isFinite(month) ||
      month < 1 ||
      month > 12 ||
      !Number.isFinite(cls) ||
      !section
    ) {
      throw new ApiError(400, "Invalid year, month, class, or section");
    }

    this.assertTeacherAccess(user, cls, year, section);

    const schoolId =
      getRlsContext()?.schoolId ?? user?.school_id ?? user?.schoolId;
    if (!schoolId) {
      throw new ApiError(400, "School context is required");
    }

    const inline = opts?.inline ?? ATTENDANCE_SHEET_INLINE;
    const t0 = Date.now();
    const whereKey = {
      attendance_sheet_scope: {
        school_id: schoolId,
        year,
        month,
        class: cls,
        section,
      },
    };

    const tryServeFresh = async (): Promise<SheetServeResult | null> => {
      const row = await prisma.attendance_sheets.findUnique({
        where: whereKey,
        select: {
          status: true,
          input_hash: true,
          r2_key: true,
          design_version: true,
        },
      });
      // Stale layout (design bump) must not be treated as fresh.
      if (
        row?.design_version &&
        row.design_version !== ATTENDANCE_SHEET_DESIGN_VERSION
      ) {
        return null;
      }
      if (!(await this.isCacheFresh(year, month, cls, section, row))) {
        return null;
      }
      const buf = await getFileBuffer(row!.r2_key!);
      if (!buf) return null;
      const mm = String(month).padStart(2, "0");
      return {
        buffer: buf,
        filename: `attendance_${year}-${mm}_class-${cls}-${section}.pdf`,
      };
    };

    // Queue path: serve cached PDF when hash+design match.
    // Inline path: always re-render below (still writes same DB + R2).
    let fresh = inline ? null : await tryServeFresh();
    if (fresh) {
      logger.info("[attendance-sheet] serve: cache fresh", {
        year,
        month,
        class: cls,
        section,
        inline,
        bytes: fresh.buffer.length,
        ms: Date.now() - t0,
      });
      return fresh;
    }

    await prisma.attendance_sheets.upsert({
      where: whereKey,
      create: {
        school_id: schoolId,
        year,
        month,
        class: cls,
        section,
        status: "pending",
      },
      update: {
        status: "pending",
        error: null,
        attempts: 0,
      },
    });

    const job: AttendanceSheetJob = {
      schoolId,
      year,
      month,
      class: cls,
      section,
    };

    if (inline) {
      // Same processJob as the Bull worker → same R2 upload + DB ready row.
      // Only the trigger differs (this request vs queue). Retry if a mid-render
      // hash drift left the row pending (queue would deferRequeue instead).
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          await prisma.attendance_sheets.update({
            where: whereKey,
            data: { status: "pending", error: null },
          });
        }
        await this.processJob(job, { inline: true });

        const row = await prisma.attendance_sheets.findUnique({
          where: whereKey,
          select: { status: true, error: true },
        });
        if (row?.status === "failed") {
          throw new ApiError(
            500,
            row.error ?? "Attendance sheet generation failed",
          );
        }

        fresh = await tryServeFresh();
        if (fresh) {
          logger.info("[attendance-sheet] serve: inline ready", {
            year,
            month,
            class: cls,
            section,
            bytes: fresh.buffer.length,
            ms: Date.now() - t0,
            attempt: attempt + 1,
          });
          return fresh;
        }
      }
      throw new ApiError(500, "Attendance sheet generation failed");
    }

    await enqueueUserPriority(
      job,
      attendanceSheetJobId(schoolId, year, month, cls, section),
    ).catch(() => { });

    const deadline = Date.now() + SERVE_TIMEOUT_MS;
    let lastNudge = Date.now();
    while (Date.now() < deadline) {
      const row = await prisma.attendance_sheets.findUnique({
        where: whereKey,
        select: { status: true, error: true },
      });
      if (row?.status === "failed") {
        throw new ApiError(
          500,
          row.error ?? "Attendance sheet generation failed",
        );
      }

      fresh = await tryServeFresh();
      if (fresh) {
        logger.info("[attendance-sheet] serve: worker ready", {
          year,
          month,
          class: cls,
          section,
          bytes: fresh.buffer.length,
          ms: Date.now() - t0,
        });
        return fresh;
      }

      // Re-nudge every 10s in case Redis job was completed/orphaned or queue
      // was paused at the first enqueue.
      if (Date.now() - lastNudge > 10_000) {
        lastNudge = Date.now();
        await ensureJobQueued(
          job,
          attendanceSheetJobId(schoolId, year, month, cls, section),
          PRIORITY_USER,
        ).catch(() => { });
        await enqueueUserPriority(
          job,
          attendanceSheetJobId(schoolId, year, month, cls, section),
        ).catch(() => { });
      }
      await sleep(SERVE_POLL_MS);
    }

    throw new ApiError(
      504,
      "Attendance sheet generation timed out. Please try again.",
    );
  }

  /**
   * Render PDF → upload R2 → mark attendance_sheets ready.
   * Used by both the Bull worker and inline serve (identical DB/R2 output).
   */
  static async processJob(
    job: AttendanceSheetJob,
    opts?: { inline?: boolean },
  ): Promise<void> {
    const { schoolId, year, month, class: cls, section } = job;
    const inline = opts?.inline === true;
    const t0 = Date.now();

    await runWithRlsContext(
      { schoolId, isSuperAdmin: false, inRlsTransaction: false },
      async () => {
        const whereKey = {
          attendance_sheet_scope: {
            school_id: schoolId,
            year,
            month,
            class: cls,
            section,
          },
        };

        const claim = await prisma.attendance_sheets.updateMany({
          where: {
            school_id: schoolId,
            year,
            month,
            class: cls,
            section,
            status: { in: ["pending", "failed"] },
          },
          data: { status: "generating", attempts: { increment: 1 } },
        });
        if (claim.count === 0) {
          // Bull retry after a crash: row stuck in generating, job still valid.
          // Reclaim so we don't no-op and leave the sheet orphaned until boot.
          const reclaim = await prisma.attendance_sheets.updateMany({
            where: {
              school_id: schoolId,
              year,
              month,
              class: cls,
              section,
              status: "generating",
            },
            data: { attempts: { increment: 1 } },
          });
          if (reclaim.count === 0) {
            logger.debug("[attendance-sheet] job: not claimable, skipping", {
              year,
              month,
              class: cls,
              section,
              inline,
            });
            return;
          }
          logger.info("[attendance-sheet] job: reclaimed generating", {
            year,
            month,
            class: cls,
            section,
            inline,
          });
        }

        const deferOrRetry = () => {
          // Queue path: re-enqueue after this handler finishes.
          // Inline path: leave pending; serve() retries processJob.
          if (!inline) this.deferRequeue(job);
        };

        try {
          const monthEnded = isAttendanceMonthEnded(year, month);
          let row = await prisma.attendance_sheets.findUnique({
            where: whereKey,
            select: {
              input_hash: true,
              r2_key: true,
              snapshot_teacher_id: true,
              snapshot_teacher_name: true,
              design_version: true,
            },
          });

          // Pin design for ended months before hashing (teacher stays omitted
          // until a successful render writes snapshot_* — never stamp live
          // teacher onto an existing PDF here).
          if (monthEnded && !row?.design_version) {
            await prisma.attendance_sheets.update({
              where: whereKey,
              data: { design_version: ATTENDANCE_SHEET_DESIGN_VERSION },
            });
            row = {
              ...row!,
              design_version: ATTENDANCE_SHEET_DESIGN_VERSION,
            };
          }

          const hashAtStart = await this.computeInputHash(
            year,
            month,
            cls,
            section,
          );

          if (
            !inline &&
            row?.input_hash === hashAtStart &&
            row.r2_key &&
            (await headObject(row.r2_key))
          ) {
            const afterSkip = await prisma.attendance_sheets.findUnique({
              where: whereKey,
              select: { status: true },
            });
            if (afterSkip?.status !== "generating") {
              await prisma.attendance_sheets.update({
                where: whereKey,
                data: { status: "pending", error: null },
              });
              deferOrRetry();
              logger.info(
                "[attendance-sheet] job: DEFER after skip (concurrent edit)",
                { year, month, class: cls, section, inline, ms: Date.now() - t0 },
              );
              return;
            }

            // Fresh PDF: keep teacher pin on ended months; always sync design.
            if (!monthEnded) {
              const seed = await prisma.levels.findFirst({
                where: { class_name: cls, section, year },
                select: {
                  teacher_id: true,
                  teacher: { select: { name: true } },
                },
              });
              await prisma.attendance_sheets.update({
                where: whereKey,
                data: {
                  status: "ready",
                  error: null,
                  design_version: ATTENDANCE_SHEET_DESIGN_VERSION,
                  snapshot_teacher_id: seed?.teacher_id ?? null,
                  snapshot_teacher_name: seed?.teacher?.name ?? null,
                },
              });
            } else {
              await prisma.attendance_sheets.update({
                where: whereKey,
                data: {
                  status: "ready",
                  error: null,
                  design_version: ATTENDANCE_SHEET_DESIGN_VERSION,
                },
              });
            }
            logger.info("[attendance-sheet] job: hash fresh, skip render", {
              year,
              month,
              class: cls,
              section,
              inline,
              ms: Date.now() - t0,
            });
            return;
          }

          const {
            buffer,
            teacherId: usedTeacherId,
            teacherName: usedTeacherName,
          } = await this.renderPdf(year, month, cls, section);

          const hashAtEnd = await this.computeInputHash(
            year,
            month,
            cls,
            section,
          );
          const afterRender = await prisma.attendance_sheets.findUnique({
            where: whereKey,
            select: { status: true },
          });

          // Inputs changed or invalidate flipped status mid-render — do not
          // promote to ready or write the drifted hash (would skip-regen forever).
          if (
            hashAtEnd !== hashAtStart ||
            afterRender?.status !== "generating"
          ) {
            await prisma.attendance_sheets.update({
              where: whereKey,
              data: { status: "pending", error: null },
            });
            deferOrRetry();
            logger.info(
              "[attendance-sheet] job: DEFER after render (concurrent edit)",
              {
                year,
                month,
                class: cls,
                section,
                inline,
                bytes: buffer.length,
                ms: Date.now() - t0,
              },
            );
            return;
          }

          // Pin teacher on ended months; design always tracks live version.
          const snapTeacherId =
            monthEnded && row?.snapshot_teacher_id != null
              ? row.snapshot_teacher_id
              : usedTeacherId;
          const snapTeacherName =
            monthEnded && row?.snapshot_teacher_id != null
              ? (row.snapshot_teacher_name ?? usedTeacherName)
              : usedTeacherName;
          const snapDesign = ATTENDANCE_SHEET_DESIGN_VERSION;

          // Persist snapshot before final hash so ended-month fingerprint
          // includes the teacher we just pinned (avoids perpetual regen).
          await prisma.attendance_sheets.update({
            where: whereKey,
            data: {
              snapshot_teacher_id: snapTeacherId,
              snapshot_teacher_name: snapTeacherName,
              design_version: snapDesign,
            },
          });
          const hashFinal = await this.computeInputHash(
            year,
            month,
            cls,
            section,
          );

          const key = this.r2Key(schoolId, year, month, cls, section);
          await uploadToR2(key, buffer);
          await prisma.attendance_sheets.update({
            where: whereKey,
            data: {
              status: "ready",
              r2_key: key,
              input_hash: hashFinal,
              generated_at: new Date(),
              error: null,
              design_version: snapDesign,
              snapshot_teacher_id: snapTeacherId,
              snapshot_teacher_name: snapTeacherName,
            },
          });

          logger.info("[attendance-sheet] job: READY", {
            year,
            month,
            class: cls,
            section,
            inline,
            bytes: buffer.length,
            ms: Date.now() - t0,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          logger.error("[attendance-sheet] job: FAILED", {
            year,
            month,
            class: cls,
            section,
            inline,
            error: msg,
          });
          await prisma.attendance_sheets
            .update({
              where: whereKey,
              data: { status: "failed", error: msg.slice(0, 500) },
            })
            .catch(() => { });
          throw e; // Bull retries; inline serve surfaces as 500
        }
      },
    );
  }

  private static async loadSheetData(
    year: number,
    month: number,
    cls: number,
    section: string,
  ): Promise<{
    school: (Awaited<ReturnType<typeof SchoolService.getSchoolInfo>> & {
      eiin?: string | null;
      website?: string | null;
    }) | null;
    teacherId: number | null;
    teacherName: string | null;
    students: StudentRow[];
    daysInMonth: number;
  }> {
    const schoolId = getRlsContext()?.schoolId;
    const mm = String(month).padStart(2, "0");
    const start = `${year}-${mm}-01`;
    const daysInMonth = new Date(year, month, 0).getDate();
    const end = `${year}-${mm}-${String(daysInMonth).padStart(2, "0")}`;
    const ended = isAttendanceMonthEnded(year, month);

    const [schoolInfo, schoolHdr, level, enrollments, sheet] = await Promise.all([
      schoolId ? SchoolService.getSchoolInfo(schoolId) : Promise.resolve(null),
      schoolId
        ? prisma.school.findUnique({
          where: { id: schoolId },
          select: { customDomain: true, eiin: true, website: true },
        })
        : Promise.resolve(null),
      prisma.levels.findFirst({
        where: { class_name: cls, section, year },
        select: {
          teacher_id: true,
          teacher: { select: { name: true } },
        },
      }),
      prisma.student_enrollments.findMany({
        where: { class: cls, section, year },
        select: {
          student_id: true,
          roll: true,
          student: { select: { name: true, available: true } },
        },
        orderBy: [{ roll: "asc" }, { student_id: "asc" }],
      }),
      prisma.attendance_sheets.findFirst({
        where: { year, month, class: cls, section },
        select: {
          snapshot_teacher_id: true,
          snapshot_teacher_name: true,
        },
      }),
    ]);

    const websiteRaw =
      schoolHdr?.customDomain?.trim() ||
      schoolHdr?.website?.trim() ||
      schoolInfo?.website?.trim() ||
      null;
    const school = schoolInfo
      ? {
        ...schoolInfo,
        eiin: schoolHdr?.eiin ?? (schoolInfo as { eiin?: string | null }).eiin,
        website: websiteRaw,
      }
      : null;
    const useSnapshot =
      ended &&
      sheet?.snapshot_teacher_id != null;
    const teacherId = useSnapshot
      ? sheet!.snapshot_teacher_id
      : (level?.teacher_id ?? null);
    const teacherName = useSnapshot
      ? (sheet!.snapshot_teacher_name ?? null)
      : (level?.teacher?.name ?? null);

    // Drop orphan enrollments (no student row) so we never draw a blank line.
    const valid = enrollments.filter(
      (e) => e.student && e.student.name?.trim(),
    );
    const studentIds = valid.map((e) => e.student_id);

    const attendance =
      studentIds.length === 0
        ? []
        : await prisma.attendence.findMany({
          where: {
            student_id: { in: studentIds },
            date: { gte: start, lte: end },
          },
          select: { student_id: true, date: true, status: true },
        });

    const byStudent = new Map<number, Record<number, string>>();
    for (const row of attendance) {
      const day = parseInt(row.date.slice(8, 10), 10);
      if (!Number.isFinite(day) || day < 1 || day > daysInMonth) continue;
      const map = byStudent.get(row.student_id) ?? {};
      map[day] = row.status;
      byStudent.set(row.student_id, map);
    }

    // Include inactive students in roll order — no "(inactive)" label on PDF.
    const students: StudentRow[] = valid.map((e) => ({
      studentId: e.student_id,
      roll: e.roll,
      name: e.student!.name.trim(),
      available: e.student!.available ?? true,
      days: byStudent.get(e.student_id) ?? {},
    }));

    return {
      school,
      teacherId,
      teacherName,
      students,
      daysInMonth,
    };
  }

  static async renderPdf(
    year: number,
    month: number,
    cls: number,
    section: string,
  ): Promise<{
    buffer: Buffer;
    teacherId: number | null;
    teacherName: string | null;
  }> {
    const { school, teacherId, teacherName, students, daysInMonth } =
      await this.loadSheetData(year, month, cls, section);

    // Zero margins: we position everything absolutely. A non-zero bottom
    // margin makes PDFKit auto-add pages when text Y > page.maxY(), which
    // splits the last student row (roll / name / marks) across blank pages.
    const doc = new (PDFDocument as any)({
      size: "A4",
      layout: "portrait",
      margins: { top: 0, left: 0, right: 0, bottom: 0 },
      autoFirstPage: true,
    }) as PDFKit.PDFDocument;
    registerFonts(doc);

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      try {
        const pages =
          students.length === 0
            ? 1
            : Math.ceil(students.length / STUDENTS_PER_PAGE);

        for (let pageIdx = 0; pageIdx < pages; pageIdx++) {
          if (pageIdx > 0) doc.addPage();
          const slice = students.slice(
            pageIdx * STUDENTS_PER_PAGE,
            (pageIdx + 1) * STUDENTS_PER_PAGE,
          );
          this.drawPage(doc, {
            school,
            year,
            month,
            cls,
            section,
            daysInMonth,
            students: slice,
            pageIdx,
            pageCount: pages,
            rowOffset: pageIdx * STUDENTS_PER_PAGE,
          });
        }
        doc.end();
      } catch (e) {
        reject(e);
      }
    });

    return { buffer, teacherId, teacherName };
  }

  private static drawPage(
    doc: PDFKit.PDFDocument,
    opts: {
      school: (Awaited<ReturnType<typeof SchoolService.getSchoolInfo>> & {
        eiin?: string | null;
        website?: string | null;
      }) | null;
      year: number;
      month: number;
      cls: number;
      section: string;
      daysInMonth: number;
      students: StudentRow[];
      pageIdx: number;
      pageCount: number;
      rowOffset: number;
    },
  ) {
    const {
      school,
      year,
      month,
      cls,
      section,
      daysInMonth,
      students,
      pageIdx,
      pageCount,
    } = opts;

    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const marginX = 16;
    const marginTop = 16;
    const contentW = pageW - marginX * 2;
    const cellOpts = { lineBreak: false as const };

    // Dense portrait layout — pack as many student rows as fit.
    const FONT_GOVT = 8;
    const FONT_SCHOOL = 13;
    const FONT_PLACE = 10.5;
    const FONT_META = 9;
    const FONT_TITLE = 11;
    const FONT_INFO = 11;
    const FONT_COL_HEADER = 8;
    const FONT_BODY = 7;
    const FONT_MARK = 6.5;

    // —— Header ——
    let y = marginTop;
    doc
      .fillColor("#1a1a1a")
      .font(FONT_BOLD)
      .fontSize(FONT_GOVT)
      .text("Government of the People's Republic of Bangladesh", marginX, y, {
        width: contentW,
        align: "center",
        ...cellOpts,
      });
    y += FONT_GOVT + 3;

    const schoolName = (school?.name || "School").toUpperCase();
    let nameSize = FONT_SCHOOL;
    doc.font(FONT_BOLD);
    while (
      doc.fontSize(nameSize).widthOfString(schoolName) > contentW - 6 &&
      nameSize > 9
    ) {
      nameSize--;
    }
    doc.fontSize(nameSize).text(schoolName, marginX, y, {
      width: contentW,
      align: "center",
      ...cellOpts,
    });
    y += nameSize + 2;

    const placeParts = [
      school?.upazila,
      school?.district,
      school?.location,
    ].filter(Boolean);
    const placeLine =
      placeParts.length > 0 ? placeParts.join(", ") : school?.address || "";
    if (placeLine) {
      doc
        .font(FONT_BOLD)
        .fontSize(FONT_PLACE)
        .text(placeLine, marginX, y, {
          width: contentW,
          align: "center",
          ...cellOpts,
        });
      y += FONT_PLACE + 2;
    }

    // Same as marksheet: website URL alone, then EIIN / phone at same size.
    const websiteUrl = formatSchoolWebsiteUrl(school?.website);
    if (websiteUrl) {
      doc
        .font(FONT_BOLD)
        .fontSize(FONT_META)
        .text(websiteUrl, marginX, y, {
          width: contentW,
          align: "center",
          ...cellOpts,
        });
      y += FONT_META + 2;
    }

    const metaBits: string[] = [];
    if (school?.eiin) metaBits.push(`EIIN: ${school.eiin}`);
    if (school?.phone) metaBits.push(`Phone: ${school.phone}`);
    if (metaBits.length) {
      doc
        .font(FONT_BOLD)
        .fontSize(FONT_META)
        .text(metaBits.join("  ·  "), marginX, y, {
          width: contentW,
          align: "center",
          ...cellOpts,
        });
      y += FONT_META + 2;
    }

    y += 6;

    doc
      .font(FONT_BOLD)
      .fontSize(FONT_TITLE)
      .fillColor("#1e3a5f")
      .text("MONTHLY ATTENDANCE SHEET", marginX, y, {
        width: contentW,
        align: "center",
        ...cellOpts,
      });
    y += FONT_TITLE + 3;

    const classLabel = CLASS_NAMES[String(cls)] || String(cls);
    const monthLabel = MONTH_NAMES[month - 1] || String(month);
    const infoLine = `Class: ${classLabel}    Section: ${section}    Month: ${monthLabel} ${year}`;
    doc
      .fillColor("#1a1a1a")
      .font(FONT_BOLD)
      .fontSize(FONT_INFO)
      .text(infoLine, marginX, y, {
        width: contentW,
        align: "center",
        ...cellOpts,
      });
    y += FONT_INFO + 5;

    // —— Table ——
    // Pack STUDENTS_PER_PAGE rows into remaining page height.
    // Leave 1.5" blank at the bottom (signatures / stamps when printed).
    const tableTop = y;
    const footerReserve = 1.5 * 72; // 1.5 inches in PDF points
    const tableBottom = Math.min(pageH - footerReserve, doc.page.maxY() - 2);
    const availableH = Math.max(120, tableBottom - tableTop);

    const headerRowH = FONT_COL_HEADER + 6;
    const rowH = (availableH - headerRowH) / STUDENTS_PER_PAGE;
    const rowsToDraw = students.length;

    // Name col ~126pt in reference landscape; keep similar on portrait.
    const rollW = 20;
    const presentW = 16;
    const absentW = 16;
    const nameW = 95;
    const dayAreaW = contentW - rollW - nameW - presentW - absentW;
    const dayW = dayAreaW / daysInMonth;

    const colX = {
      roll: marginX,
      name: marginX + rollW,
      day0: marginX + rollW + nameW,
      present: marginX + rollW + nameW + dayAreaW,
      absent: marginX + rollW + nameW + dayAreaW + presentW,
    };

    const vLines = [
      colX.name,
      colX.day0,
      ...Array.from(
        { length: daysInMonth - 1 },
        (_, i) => colX.day0 + (i + 1) * dayW,
      ),
      colX.present,
      colX.absent,
    ];

    const drawVLines = (top: number, h: number) => {
      for (const x of vLines) {
        doc.moveTo(x, top).lineTo(x, top + h).stroke();
      }
    };

    // Header
    doc.save().rect(marginX, tableTop, contentW, headerRowH).fill("#e8eef5");
    doc.restore();
    doc.strokeColor("#1a1a1a").lineWidth(0.55);
    doc.rect(marginX, tableTop, contentW, headerRowH).stroke();
    drawVLines(tableTop, headerRowH);

    const headerY = tableTop + (headerRowH - FONT_COL_HEADER) / 2;
    doc.fillColor("#1a1a1a").font(FONT_BOLD).fontSize(FONT_COL_HEADER);
    doc.text("Roll", colX.roll, headerY, {
      width: rollW,
      align: "center",
      ...cellOpts,
    });
    doc.text("Student Name", colX.name + 2, headerY, {
      width: nameW - 4,
      align: "left",
      ...cellOpts,
    });
    for (let d = 1; d <= daysInMonth; d++) {
      doc.text(String(d), colX.day0 + (d - 1) * dayW, headerY, {
        width: dayW,
        align: "center",
        ...cellOpts,
      });
    }
    doc.text("P", colX.present, headerY, {
      width: presentW,
      align: "center",
      ...cellOpts,
    });
    doc.text("A", colX.absent, headerY, {
      width: absentW,
      align: "center",
      ...cellOpts,
    });

    // Body — only real students (no empty pad rows after list ends)
    let rowY = tableTop + headerRowH;
    for (let i = 0; i < rowsToDraw; i++) {
      const student = students[i];
      const isAlt = i % 2 === 1;

      if (isAlt) {
        doc.save().rect(marginX, rowY, contentW, rowH).fill("#f7f9fc");
        doc.restore();
      }

      doc.strokeColor("#1a1a1a").lineWidth(0.35);
      doc.rect(marginX, rowY, contentW, rowH).stroke();
      drawVLines(rowY, rowH);

      if (student) {
        const textY = rowY + (rowH - FONT_BODY) / 2;

        let presentCount = 0;
        let absentCount = 0;
        for (let d = 1; d <= daysInMonth; d++) {
          const st = (student.days[d] || "").trim().toLowerCase();
          if (st === "present" || st === "run-awayed" || st === "runaway")
            presentCount++;
          else if (st === "absent") absentCount++;
        }

        doc.fillColor("#1a1a1a").font(FONT_REGULAR).fontSize(FONT_BODY);
        doc.text(
          student.roll != null ? String(student.roll) : "—",
          colX.roll,
          textY,
          { width: rollW, align: "center", ...cellOpts },
        );
        // Shrink name font to fit — never truncate.
        const nameMaxW = nameW - 3;
        let nameSize = FONT_BODY;
        doc.font(FONT_REGULAR);
        while (
          nameSize > 4.5 &&
          doc.fontSize(nameSize).widthOfString(student.name) > nameMaxW
        ) {
          nameSize -= 0.5;
        }
        const nameY = rowY + (rowH - nameSize) / 2;
        doc.fontSize(nameSize).text(student.name, colX.name + 1.5, nameY, {
          width: nameMaxW,
          align: "left",
          ...cellOpts,
        });

        for (let d = 1; d <= daysInMonth; d++) {
          const mark = statusMark(student.days[d]);
          if (!mark) continue;
          const color = mark === "P" ? "#166534" : "#b91c1c";
          doc
            .fillColor(color)
            .font(FONT_BOLD)
            .fontSize(FONT_MARK)
            .text(mark, colX.day0 + (d - 1) * dayW, textY, {
              width: dayW,
              align: "center",
              ...cellOpts,
            });
        }

        doc
          .fillColor("#1a1a1a")
          .font(FONT_REGULAR)
          .fontSize(FONT_BODY)
          .text(String(presentCount), colX.present, textY, {
            width: presentW,
            align: "center",
            ...cellOpts,
          });
        doc.text(String(absentCount), colX.absent, textY, {
          width: absentW,
          align: "center",
          ...cellOpts,
        });
      }

      rowY += rowH;
    }

    // Outer border (header only if no students)
    const tableH = Math.max(headerRowH, rowY - tableTop);
    doc
      .strokeColor("#1e3a5f")
      .lineWidth(1)
      .rect(marginX, tableTop, contentW, tableH)
      .stroke();

    // Page number only (no generated date)
    if (pageCount > 1) {
      doc
        .fillColor("#666666")
        .font(FONT_REGULAR)
        .fontSize(7)
        .text(`Page ${pageIdx + 1} of ${pageCount}`, marginX, pageH - 16, {
          width: contentW,
          align: "center",
          ...cellOpts,
        });
    }
  }
}
