import crypto from "crypto";
import { prisma } from "@/config/prisma.js";
import {
  getFileBuffer,
  getDownloadUrl,
  uploadToR2,
  headObject,
  headObjectEtag,
  deleteFromR2,
  listKeys,
} from "@/config/r2.js";
import { getRlsContext, runWithRlsContext } from "@/config/rlsContextStore.js";
import logger from "@/utils/logger.js";
import { MarksService } from "./marks.service.js";
import { mergeMarksheetPdfs } from "./marksheet-bundle-merge.js";
import {
  marksheetQueue,
  defaultJobOpts,
  enqueueUserPriority,
  ensureJobQueued,
  ensureJobQueuedAfterDefer,
  jobId,
  bundleJobId,
  sessionStudentJobId,
  sessionYearJobId,
  PRIORITY_BACKFILL,
  PRIORITY_USER,
  type MarksheetJob,
  type StudentJob,
  type BundleJob,
  type SessionStudentJob,
  type SessionYearJob,
} from "./marksheet.queue.js";

// The worker has no HTTP user; marksheets are already school-scoped by RLS, so
// an admin-role synthetic user only satisfies the in-code access check.
const WORKER_USER = { role: "admin" as const };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * An exam is "frozen" once its result_date (a YYYY-MM-DD string) is strictly in
 * the past. Marksheets for a frozen exam pin the signatories that were in place
 * when they were finalized, so a later head/class-teacher reassignment no longer
 * regenerates or re-stamps them. Marks and class-highest stay live regardless.
 * A missing/unparseable result_date is treated as NOT frozen (still open).
 */
export function isExamFrozen(resultDate: string | null | undefined): boolean {
  if (!resultDate) return false;
  // result_date is a plain calendar date (VarChar(10), "YYYY-MM-DD"). Compare it
  // as a date string against today's local calendar date so the frozen boundary
  // is timezone-agnostic — never parse it to a Date (that pins UTC midnight and
  // misclassifies the boundary day on non-UTC servers).
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(resultDate.trim());
  if (!m) return false;
  const resultDay = `${m[1]}-${m[2]}-${m[3]}`;
  const now = new Date();
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(now.getDate()).padStart(2, "0")}`;
  return resultDay < todayLocal;
}

/**
 * Bump when marksheet PDF layout / draw code changes.
 * Open exams (result_date not passed) go stale and regenerate.
 * Frozen exams pin `snapshot_design_version` at generation — same rule as
 * head/class-teacher: finalized PDFs keep the design that signed them.
 */
export const MARKSHEET_DESIGN_VERSION = "14";

/**
 * Bundle assemble aborts for a class with nothing to merge — no enrollments, or
 * enrollments but not a single non-null mark. Neither is a failure: there is
 * simply no bundle to produce, so the row is terminal (`skipped`) rather than
 * retried forever.
 */
const EMPTY_BUNDLE_MESSAGES = [
  "No students found",
  "No non-null marks found",
];

/** Throttle gap-fill on generation-status polls (avoids heavy DB work every few seconds). */
const ensureQueuedLastRun = new Map<number, number>();
const ENSURE_QUEUED_COOLDOWN_MS = 30_000;

function isEmptyBundleError(message: string): boolean {
  return EMPTY_BUNDLE_MESSAGES.some((m) => message.includes(m));
}

/**
 * Consecutive automatic retries allowed for a failed bundle before the poll
 * driven re-queue gives up. Reset on an explicit download and on success, so
 * only an unattended failure loop is capped.
 */
const MAX_BUNDLE_ATTEMPTS = 5;

/** Stable ISO for hash fingerprints — Date vs string must not flip the digest. */
function isoStamp(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

/** Design field for input hashes. Frozen + no snapshot → omit (legacy compat). */
function designFingerprint(
  frozen: boolean,
  snapshotVersion: string | null | undefined,
): { d?: string } {
  if (frozen) {
    return snapshotVersion ? { d: snapshotVersion } : {};
  }
  return { d: MARKSHEET_DESIGN_VERSION };
}

const SERVE_TIMEOUT_MS = Number(process.env.MARKSHEET_SERVE_TIMEOUT_MS || "180000");
const SERVE_POLL_MS = Number(process.env.MARKSHEET_SERVE_POLL_MS || "500");

export type BundleServeResult = { kind: "redirect"; url: string };

export class MarksheetService {
  private static bundleSectionKey(bundleSection?: string): string {
    return bundleSection?.trim() || "ALL";
  }

  private static parseBundleSections(
    bundleSection: string,
  ): string[] | undefined {
    if (bundleSection === "ALL") return undefined;
    if (bundleSection.includes("+")) {
      return bundleSection.split("+").filter(Boolean);
    }
    return [bundleSection];
  }

  private static enrollmentWhereForBundleSection(
    cls: number,
    year: number,
    bundleSection: string,
  ): { class: number; year: number; section?: string | { in: string[] } } {
    const where: {
      class: number;
      year: number;
      section?: string | { in: string[] };
    } = { class: cls, year };
    const sections = this.parseBundleSections(bundleSection);
    if (sections?.length === 1) where.section = sections[0];
    else if (sections && sections.length > 1) where.section = { in: sections };
    return where;
  }

  /** DB/R2 key for admin whole-class / one-section, or teacher section-scoped bundles. */
  static resolveBundleSection(
    user: any,
    cls: number,
    year: number,
    sectionQuery?: string,
  ): string {
    const requested = sectionQuery?.trim() || undefined;

    if (user?.role === "admin") {
      // Admin may download whole class (ALL) or one section when UI passes ?section=
      return requested || "ALL";
    }
    if (user?.role !== "teacher") return requested || "ALL";

    const assignedSections = (user.levels ?? [])
      .filter((l: any) => l.class_name === cls && l.year === year)
      .map((l: any) => l.section)
      .filter(Boolean);

    if (assignedSections.length === 0) {
      throw new Error("You are not assigned to this class.");
    }
    if (requested) {
      if (!assignedSections.includes(requested)) {
        throw new Error("You are not assigned to this section.");
      }
      return requested;
    }
    return [...new Set(assignedSections)].sort().join("+");
  }

  /**
   * Append a content fingerprint to a *stable public* download URL so a CDN in
   * front of the R2 bucket treats a regenerated file (same key/path) as a new
   * resource. The origin object is always overwritten fresh before the URL is
   * handed out, but an edge cache keyed on the URL would otherwise serve the
   * stale copy until its TTL expires. Varying the query string varies the cache
   * key, forcing a revalidation.
   *
   * Presigned URLs (SigV4) are returned unchanged: they sign the ENTIRE query
   * string, so appending a param after signing invalidates the signature
   * (SignatureDoesNotMatch). They also rotate their signature on every request,
   * so a CDN cannot serve a stale copy by URL — they neither need nor tolerate
   * busting. Only the R2_PUBLIC_URL path produces a stable, bustable URL.
   */
  private static withCacheBust(url: string, hash: string | null): string {
    if (!hash) return url;
    if (/[?&]X-Amz-Signature=/i.test(url)) return url;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}v=${hash.slice(0, 16)}`;
  }

  /** student_id = 0 means the school-year "all" session PDF. */
  private static readonly SESSION_YEAR_STUDENT_ID = 0;

  private static async isSessionCacheFresh(
    schoolId: number,
    year: number,
    studentId: number,
    hash: string,
  ): Promise<{ r2_key: string } | null> {
    const row = await prisma.marksheet_sessions.findUnique({
      where: {
        marksheet_session_scope: {
          school_id: schoolId,
          year,
          student_id: studentId,
        },
      },
      select: { status: true, input_hash: true, r2_key: true },
    });
    if (
      !row ||
      row.status !== "ready" ||
      !row.r2_key ||
      !row.input_hash ||
      row.input_hash !== hash
    ) {
      return null;
    }
    if (!(await headObject(row.r2_key))) return null;
    return { r2_key: row.r2_key };
  }

  private static async headMsgFingerprint(): Promise<{
    u: string | null;
    id: number | null;
    role: string | null;
    name: string | null;
    sig: string | null;
    sigv: string | null;
  }> {
    const head = await prisma.head_msg.findFirst({
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
      select: {
        updated_at: true,
        head_id: true,
        head_role: true,
        teacher: { select: { name: true, signature: true } },
      },
    });
    const sig = head?.teacher?.signature ?? null;
    return {
      u: isoStamp(head?.updated_at),
      id: head?.head_id ?? null,
      role: head?.head_role ?? null,
      name: head?.teacher?.name ?? null,
      sig,
      sigv: await this.signatureEtag(sig),
    };
  }

  /** Class-teacher assignments that appear on marksheets (per class/section/year). */
  private static async classTeacherFingerprint(
    cls: number,
    year: number,
    sections?: string[],
  ): Promise<
    Array<{
      sec: string;
      id: number;
      name: string | null;
      sig: string | null;
      sigv: string | null;
    }>
  > {
    const where: {
      class_name: number;
      year: number;
      section?: { in: string[] };
    } = { class_name: cls, year };
    if (sections && sections.length > 0) {
      where.section = { in: sections };
    }
    const rows = await prisma.levels.findMany({
      where,
      select: {
        section: true,
        teacher_id: true,
        teacher: { select: { name: true, signature: true } },
      },
      orderBy: [{ section: "asc" }, { teacher_id: "asc" }],
    });
    return Promise.all(
      rows.map(async (r) => {
        const sig = r.teacher?.signature ?? null;
        return {
          sec: r.section,
          id: r.teacher_id,
          name: r.teacher?.name ?? null,
          sig,
          sigv: await this.signatureEtag(sig),
        };
      }),
    );
  }

  private static async yearClassTeacherFingerprint(
    year: number,
  ): Promise<
    Array<{
      cls: number;
      sec: string;
      id: number;
      name: string | null;
      sig: string | null;
      sigv: string | null;
    }>
  > {
    const rows = await prisma.levels.findMany({
      where: { year },
      select: {
        class_name: true,
        section: true,
        teacher_id: true,
        teacher: { select: { name: true, signature: true } },
      },
      orderBy: [{ class_name: "asc" }, { section: "asc" }, { teacher_id: "asc" }],
    });
    return Promise.all(
      rows.map(async (r) => {
        const sig = r.teacher?.signature ?? null;
        return {
          cls: r.class_name,
          sec: r.section,
          id: r.teacher_id,
          name: r.teacher?.name ?? null,
          sig,
          sigv: await this.signatureEtag(sig),
        };
      }),
    );
  }

  /**
   * Head fingerprint resolved by a snapshotted teacher id (the "who"), reading
   * that person's CURRENT name/signature. Used for frozen exams so a later head
   * reassignment is ignored while the same person's later signature upload is not.
   */
  private static async headFingerprintById(
    headId: number | null,
    headRole: string | null,
  ): Promise<{
    id: number | null;
    role: string | null;
    name: string | null;
    sig: string | null;
    sigv: string | null;
  }> {
    if (headId == null) {
      return {
        id: null,
        role: headRole ?? null,
        name: null,
        sig: null,
        sigv: null,
      };
    }
    const t = await prisma.teachers.findUnique({
      where: { id: headId },
      select: { name: true, signature: true },
    });
    const sig = t?.signature ?? null;
    return {
      id: headId,
      role: headRole ?? "Headmaster",
      name: t?.name ?? null,
      sig,
      sigv: await this.signatureEtag(sig),
    };
  }

  /** Class-teacher fingerprint(s) resolved by snapshotted teacher id(s). */
  private static async teacherFingerprintByIds(
    sectionToTeacherId: Record<string, number>,
  ): Promise<
    Array<{
      sec: string;
      id: number;
      name: string | null;
      sig: string | null;
      sigv: string | null;
    }>
  > {
    const entries = Object.entries(sectionToTeacherId).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return Promise.all(
      entries.map(async ([sec, id]) => {
        const t = await prisma.teachers.findUnique({
          where: { id },
          select: { name: true, signature: true },
        });
        const sig = t?.signature ?? null;
        return {
          sec,
          id,
          name: t?.name ?? null,
          sig,
          sigv: await this.signatureEtag(sig),
        };
      }),
    );
  }

  /** R2 ETag of a signature object — catches in-place overwrites at the same path. */
  private static async signatureEtag(
    path: string | null | undefined,
  ): Promise<string | null> {
    if (!path) return null;
    return headObjectEtag(path);
  }

  /**
   * Copy a live signature into an exam-scoped R2 key so frozen sheets keep the
   * bytes that were current at generate time.
   */
  private static async freezeSignatoryAsset(
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
    const dot = sourcePath.lastIndexOf(".");
    const ext =
      dot >= 0 && dot > sourcePath.lastIndexOf("/")
        ? sourcePath.slice(dot)
        : ".png";
    const dest = `${prefix}${personKey}${ext}`;
    const contentType =
      ext.toLowerCase() === ".jpg" || ext.toLowerCase() === ".jpeg"
        ? "image/jpeg"
        : ext.toLowerCase() === ".webp"
          ? "image/webp"
          : "image/png";
    await uploadToR2(dest, buf, contentType);
    return dest;
  }

  private static parseSignatoryDetail(raw: unknown): {
    head?: { name: string | null; signature: string | null } | null;
    teacher?: {
      name: string | null;
      signature: string | null;
      phone: string | null;
    } | null;
    teachers?: Record<
      string,
      { name: string | null; signature: string | null; phone: string | null }
    >;
  } | null {
    if (!raw || typeof raw !== "object") return null;
    return raw as {
      head?: { name: string | null; signature: string | null } | null;
      teacher?: {
        name: string | null;
        signature: string | null;
        phone: string | null;
      } | null;
      teachers?: Record<
        string,
        { name: string | null; signature: string | null; phone: string | null }
      >;
    };
  }

  /** Build frozen name/signature/phone detail from live teacher rows. */
  private static async captureStudentSignatoryDetail(
    schoolId: number,
    examId: number,
    head: {
      id: number | null;
      role: string | null;
      name: string | null;
      signature: string | null;
    } | null,
    teacher: {
      id: number | null;
      name: string | null;
      signature: string | null;
      phone: string | null;
    } | null,
  ): Promise<{
    head: { name: string | null; signature: string | null } | null;
    teacher: {
      name: string | null;
      signature: string | null;
      phone: string | null;
    } | null;
  }> {
    return {
      head:
        head && head.id != null
          ? {
              name: head.name,
              signature: await this.freezeSignatoryAsset(
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
              signature: await this.freezeSignatoryAsset(
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

  private static frozenHeadFingerprint(
    headId: number | null,
    headRole: string | null,
    detail: {
      head?: { name: string | null; signature: string | null } | null;
    } | null,
  ): {
    id: number | null;
    role: string | null;
    name: string | null;
    sig: string | null;
    sigv: string | null;
  } {
    return {
      id: headId,
      role: headRole ?? "Headmaster",
      name: detail?.head?.name ?? null,
      sig: detail?.head?.signature ?? null,
      // Path is exam-scoped frozen copy — no live ETag.
      sigv: null,
    };
  }

  private static frozenTeacherFingerprint(
    section: string,
    teacherId: number | null,
    detail: {
      teacher?: {
        name: string | null;
        signature: string | null;
        phone: string | null;
      } | null;
      teachers?: Record<
        string,
        { name: string | null; signature: string | null; phone: string | null }
      >;
    } | null,
  ): Array<{
    sec: string;
    id: number;
    name: string | null;
    sig: string | null;
    sigv: string | null;
  }> {
    if (teacherId == null) return [];
    const t = detail?.teachers?.[section] ?? detail?.teacher ?? null;
    return [
      {
        sec: section,
        id: teacherId,
        name: t?.name ?? null,
        sig: t?.signature ?? null,
        sigv: null,
      },
    ];
  }

  /** Website/phone/name/logo printed on marksheet headers (unpublished exams only). */
  private static async schoolMarksheetFingerprint(
    schoolId: number | null | undefined,
  ): Promise<{
    n: string | null;
    loc: string | null;
    eiin: string | null;
    cc: string | null;
    w: string | null;
    p: string | null;
    logo: string | null;
    logov: string | null;
  }> {
    const empty = {
      n: null,
      loc: null,
      eiin: null,
      cc: null,
      w: null,
      p: null,
      logo: null,
      logov: null,
    };
    if (!schoolId) return empty;
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        name: true,
        upazila: true,
        district: true,
        address: true,
        eiin: true,
        centerCode: true,
        customDomain: true,
        website: true,
        phone: true,
        logo: true,
        headerLogo: true,
      },
    });
    if (!school) return empty;
    const place = [school.upazila, school.district]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join(", ");
    const raw = (school.customDomain?.trim() || school.website?.trim() || "");
    let w: string | null = null;
    if (raw) {
      try {
        w = /^https?:\/\//i.test(raw)
          ? new URL(raw).hostname || null
          : raw.replace(/\/+$/, "").replace(/:\d+$/, "").toLowerCase();
      } catch {
        w =
          raw
            .replace(/^https?:\/\//i, "")
            .split("/")[0]
            ?.replace(/:\d+$/, "")
            .toLowerCase() || null;
      }
    }
    const logo = school.headerLogo || school.logo || null;
    return {
      n: school.name?.trim() || null,
      loc: place || school.address?.trim() || null,
      eiin: school.eiin?.trim() || null,
      cc: school.centerCode?.trim() || null,
      w,
      p: school.phone?.trim() || null,
      logo,
      logov: logo ? await this.signatureEtag(logo) : null,
    };
  }

  /**
   * Live school header branding in the hash only while the exam is unpublished.
   * After publish (or result_date freeze), branding is pinned — name/logo/website
   * edits must not churn finalized sheets (same idea as design / signatories).
   */
  private static async schoolFingerprintForExam(
    schoolId: number | null | undefined,
    exam: { visible?: boolean | null; result_date?: string | null } | null,
  ): Promise<{
    n: string | null;
    loc: string | null;
    eiin: string | null;
    cc: string | null;
    w: string | null;
    p: string | null;
    logo: string | null;
    logov: string | null;
  } | null> {
    if (exam?.visible || isExamFrozen(exam?.result_date)) return null;
    return this.schoolMarksheetFingerprint(schoolId);
  }

  /** Stable digest of student names in scope (bundle / session-year pages). */
  private static namesDigest(names: string[]): string {
    return crypto
      .createHash("sha256")
      .update(names.join("\0"))
      .digest("hex");
  }

  /**
   * Seed the signatory snapshot on student rows that don't have one yet, using
   * the CURRENT head and each student's current section class-teacher. Called
   * only for OPEN exams: it captures who was assigned while the exam was still
   * open so that if the exam freezes before a first render (e.g. a backdated
   * result_date, or a reassignment right after publish), the frozen sheet still
   * pins the open-window staff instead of whoever is current at first render.
   *
   * Only fills rows where snapshot_head_id is null — rendered rows already carry
   * an authoritative snapshot, and a reassignment while still open re-renders and
   * refreshes it, so this must not clobber those.
   */
  private static async seedOpenSnapshot(
    studentIds: number[],
    examId: number,
    year: number,
  ): Promise<void> {
    if (studentIds.length === 0) return;

    // Cheap gate on the hot marks-entry path: skip entirely once every row is
    // already seeded/rendered.
    const unseeded = await prisma.marksheet_files.findMany({
      where: {
        exam_id: examId,
        student_id: { in: studentIds },
        snapshot_head_id: null,
      },
      select: { student_id: true },
    });
    if (unseeded.length === 0) return;
    const unseededIds = unseeded.map((r) => r.student_id);

    const [head, enrollments] = await Promise.all([
      prisma.head_msg.findFirst({
        orderBy: { updated_at: "desc" },
        select: { head_id: true, head_role: true },
      }),
      prisma.student_enrollments.findMany({
        where: { student_id: { in: unseededIds }, year },
        select: { student_id: true, class: true, section: true },
      }),
    ]);
    const headId = head?.head_id ?? null;
    const headRole = head?.head_role ?? null;

    const classSet = [...new Set(enrollments.map((e) => e.class))];
    const sectionSet = [...new Set(enrollments.map((e) => e.section))];
    const levels = classSet.length
      ? await prisma.levels.findMany({
          where: {
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
      await prisma.marksheet_files.updateMany({
        where: {
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

  static r2Key(
    schoolId: number,
    year: number,
    examId: number,
    studentId: number,
  ): string {
    return `${schoolId}/marksheets/${year}/${examId}/${studentId}.pdf`;
  }

  /** True when a ready row still matches live marks/stats and R2. */
  private static async isStudentCacheFresh(
    studentId: number,
    examId: number,
    year: number,
    row: {
      status: string;
      input_hash: string | null;
      r2_key: string | null;
    } | null,
  ): Promise<boolean> {
    if (!row || row.status !== "ready") return false;
    return this.isStudentContentFresh(studentId, examId, year, row);
  }

  /**
   * Hash + R2 match for the cached PDF bytes, ignoring row status.
   * Used by bundle merge to tell "content already good, job in flight" from
   * "content actually stale / missing".
   */
  private static async isStudentContentFresh(
    studentId: number,
    examId: number,
    year: number,
    row: {
      input_hash: string | null;
      r2_key: string | null;
    } | null,
  ): Promise<boolean> {
    if (!row?.r2_key || !row.input_hash) return false;
    const hash = await this.computeInputHash(studentId, examId, year);
    if (row.input_hash !== hash) return false;
    return !!(await headObject(row.r2_key));
  }

  private static async isBundleCacheFresh(
    examId: number,
    cls: number,
    year: number,
    bundleSection: string,
    row: {
      status: string;
      input_hash: string | null;
      r2_key: string | null;
    } | null,
  ): Promise<boolean> {
    if (!row || row.status !== "ready" || !row.r2_key || !row.input_hash) {
      return false;
    }
    const hash = await this.computeBundleHash(examId, cls, year, bundleSection);
    if (row.input_hash !== hash) return false;
    return !!(await headObject(row.r2_key));
  }

  /**
   * Fingerprint of everything that changes the rendered PDF, computed with
   * cheap indexed queries (no render). Lets the worker skip regeneration when
   * an invalidation flipped a sheet whose inputs did not actually change.
   * Includes head assignment and class-teacher (levels) for the student's section.
   */
  static async computeInputHash(
    studentId: number,
    examId: number,
    year: number,
  ): Promise<string> {
    const [enrollment, exam, snapRow] = await Promise.all([
      prisma.student_enrollments.findFirst({
        where: { student_id: studentId, year },
        select: {
          class: true,
          section: true,
          roll: true,
          fourth_subject_id: true,
          school_id: true,
          student: { select: { name: true } },
        },
      }),
      prisma.exams.findUnique({
        where: { id: examId },
        select: {
          exam_name: true,
          result_date: true,
          return_date: true,
          school_id: true,
          visible: true,
        },
      }),
      prisma.marksheet_files.findUnique({
        where: { student_id_exam_id: { student_id: studentId, exam_id: examId } },
        select: {
          snapshot_head_id: true,
          snapshot_head_role: true,
          snapshot_teacher_id: true,
          snapshot_signatory_detail: true,
          snapshot_design_version: true,
        },
      }),
    ]);

    // Frozen exams pin who signed + name/signature/phone (snapshot_signatory_detail).
    // Legacy rows without detail still resolve live-by-id until the next generate.
    const frozen = isExamFrozen(exam?.result_date);
    const signatoryDetail = this.parseSignatoryDetail(
      snapRow?.snapshot_signatory_detail,
    );
    const useSnapshot =
      frozen &&
      !!snapRow &&
      (snapRow.snapshot_head_id != null || snapRow.snapshot_teacher_id != null);
    const useFrozenDetail = useSnapshot && !!signatoryDetail;

    const [markAgg, stats, head, classTeacher, school] = await Promise.all([
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
      useFrozenDetail
        ? Promise.resolve(
            this.frozenHeadFingerprint(
              snapRow!.snapshot_head_id,
              snapRow!.snapshot_head_role,
              signatoryDetail,
            ),
          )
        : useSnapshot
          ? this.headFingerprintById(
              snapRow!.snapshot_head_id,
              snapRow!.snapshot_head_role,
            )
          : this.headMsgFingerprint(),
      enrollment
        ? useFrozenDetail
          ? Promise.resolve(
              this.frozenTeacherFingerprint(
                enrollment.section,
                snapRow!.snapshot_teacher_id,
                signatoryDetail,
              ),
            )
          : useSnapshot
            ? this.teacherFingerprintByIds(
                snapRow!.snapshot_teacher_id != null
                  ? { [enrollment.section]: snapRow!.snapshot_teacher_id }
                  : {},
              )
            : this.classTeacherFingerprint(enrollment.class, year, [
                enrollment.section,
              ])
        : Promise.resolve([]),
      this.schoolFingerprintForExam(
        enrollment?.school_id ?? exam?.school_id ?? null,
        exam,
      ),
    ]);

    const fingerprint = JSON.stringify({
      n: markAgg._count?._all ?? 0,
      m: isoStamp(markAgg._max?.updated_at),
      s: isoStamp(stats?.updated_at),
      h: head,
      t: classTeacher,
      f: enrollment?.fourth_subject_id ?? null,
      r: enrollment?.roll ?? null,
      sec: enrollment?.section ?? null,
      nm: enrollment?.student?.name ?? null,
      sch: school,
      en: exam?.exam_name ?? null,
      rd: exam?.result_date ?? null,
      retd: exam?.return_date ?? null,
      ...designFingerprint(frozen, snapRow?.snapshot_design_version),
    });
    return crypto.createHash("sha256").update(fingerprint).digest("hex");
  }

  /**
   * Return a marksheet PDF for a student. Never serves a stale cache and never
   * renders inline for school-scoped exams — always waits for the worker to
   * produce a hash-verified fresh PDF in R2.
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

    await MarksService.verifyMarksheetDownloadAccess(
      studentId,
      year,
      examName,
      user,
    );

    const exam = await prisma.exams.findFirst({
      where: { exam_name: examName, exam_year: year },
      select: { id: true, school_id: true },
    });

    if (!exam?.school_id) {
      throw new Error("Marksheet cache is unavailable for this exam.");
    }

    return this.waitForFreshStudentPdf(
      {
        studentId,
        examId: exam.id,
        examName,
        year,
        schoolId: exam.school_id,
      },
      t0,
    );
  }

  /** Queue (if needed) and poll until a hash-verified student PDF exists in R2. */
  private static async waitForFreshStudentPdf(
    job: StudentJob,
    t0: number,
  ): Promise<{ buffer: Buffer; studentName: string }> {
    const { studentId, examId, examName, year, schoolId } = job;
    const whereStudent = {
      student_id_exam_id: { student_id: studentId, exam_id: examId },
    };

    const tryServeFresh = async () => {
      const row = await prisma.marksheet_files.findUnique({
        where: whereStudent,
        select: {
          status: true,
          input_hash: true,
          r2_key: true,
          student_name: true,
          error: true,
        },
      });
      if (!(await this.isStudentCacheFresh(studentId, examId, year, row))) {
        return null;
      }
      const buf = await getFileBuffer(row!.r2_key!);
      if (!buf) return null;
      return { buffer: buf, studentName: row!.student_name ?? "student" };
    };

    let fresh = await tryServeFresh();
    if (fresh) {
      logger.info("[marksheet] serve: worker cache fresh", {
        studentId,
        examId,
        bytes: fresh.buffer.length,
        ms: Date.now() - t0,
      });
      return fresh;
    }

    await prisma.marksheet_files.upsert({
      where: whereStudent,
      create: {
        student_id: studentId,
        exam_id: examId,
        exam_name: examName,
        year,
        school_id: schoolId,
        status: "pending",
      },
      update: { status: "pending", error: null, exam_name: examName },
    });
    await enqueueUserPriority(job, jobId(examId, studentId)).catch(() => {});

    logger.info("[marksheet] serve: waiting for worker", { studentId, examId });

    const deadline = Date.now() + SERVE_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const row = await prisma.marksheet_files.findUnique({
        where: whereStudent,
        select: { status: true, error: true },
      });
      if (row?.status === "failed") {
        throw new Error(row.error ?? "Marksheet generation failed");
      }
      if (row?.status === "skipped") {
        throw new Error("No marks found for this student");
      }

      fresh = await tryServeFresh();
      if (fresh) {
        logger.info("[marksheet] serve: worker ready", {
          studentId,
          examId,
          bytes: fresh.buffer.length,
          ms: Date.now() - t0,
        });
        return fresh;
      }
      await sleep(SERVE_POLL_MS);
    }

    throw new Error(
      "Marksheet generation timed out. Please try again shortly.",
    );
  }

  /** Queue (if needed) and poll until a hash-verified class bundle exists in R2. */
  private static async waitForFreshBundlePdf(
    job: BundleJob,
    t0: number,
  ): Promise<BundleServeResult> {
    const { examId, examName, year, class: cls, schoolId } = job;
    const bundleSection = this.bundleSectionKey(job.bundleSection);
    const whereKey = {
      exam_id_class_section: {
        exam_id: examId,
        class: cls,
        section: bundleSection,
      },
    };

    const tryServeFresh = async (): Promise<BundleServeResult | null> => {
      const row = await prisma.marksheet_bundles.findUnique({
        where: whereKey,
        select: { status: true, input_hash: true, r2_key: true, error: true },
      });
      if (
        !(await this.isBundleCacheFresh(
          examId,
          cls,
          year,
          bundleSection,
          row,
        ))
      ) {
        return null;
      }
      if (!(await headObject(row!.r2_key!))) return null;
      const url = this.withCacheBust(
        await getDownloadUrl(row!.r2_key!),
        row!.input_hash,
      );
      return { kind: "redirect", url };
    };

    let fresh = await tryServeFresh();
    if (fresh) {
      logger.info("[marksheet] serveBundle: worker cache fresh", {
        examId,
        class: cls,
        section: bundleSection,
        ms: Date.now() - t0,
      });
      return fresh;
    }

    await prisma.marksheet_bundles.upsert({
      where: whereKey,
      create: {
        exam_id: examId,
        exam_name: examName,
        year,
        class: cls,
        section: bundleSection,
        school_id: schoolId,
        status: "pending",
      },
      // An explicit download is a fresh intent: clear the automatic-retry
      // budget so a previously capped bundle is attempted again.
      update: {
        status: "pending",
        error: null,
        exam_name: examName,
        attempts: 0,
      },
    });
    await enqueueUserPriority(
      { ...job, kind: "bundle", bundleSection },
      bundleJobId(examId, cls, bundleSection),
    ).catch(() => {});

    const deadline = Date.now() + SERVE_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const row = await prisma.marksheet_bundles.findUnique({
        where: whereKey,
        select: { status: true, error: true },
      });
      if (row?.status === "failed") {
        throw new Error(row.error ?? "Bundle generation failed");
      }
      if (row?.status === "skipped") {
        throw new Error("No students found for this class bundle");
      }

      fresh = await tryServeFresh();
      if (fresh) {
        logger.info("[marksheet] serveBundle: worker ready", {
          examId,
          class: cls,
          section: bundleSection,
          ms: Date.now() - t0,
        });
        return fresh;
      }
      await sleep(SERVE_POLL_MS);
    }

    throw new Error("Class marksheet generation timed out. Please try again.");
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

    const studentIds = [...targets.keys()];

    // Reset any rows that already exist (mirrors the upsert `update` branch)…
    await prisma.marksheet_files.updateMany({
      where: { exam_id: examId, student_id: { in: studentIds } },
      data: { status: "pending", error: null, exam_name: examName },
    });
    // …then create the ones that don't (mirrors the upsert `create` branch).
    await prisma.marksheet_files.createMany({
      data: [...targets].map(([studentId, yr]) => ({
        student_id: studentId,
        exam_id: examId,
        exam_name: examName,
        year: yr,
        school_id: schoolId,
        status: "pending",
      })),
      skipDuplicates: true,
    });

    const jobs: { data: MarksheetJob; opts: any }[] = [...targets].map(
      ([studentId, yr]) => ({
        data: { studentId, examId, examName, year: yr, schoolId },
        opts: {
          jobId: jobId(examId, studentId),
          ...defaultJobOpts(PRIORITY_BACKFILL),
        },
      }),
    );

    await marksheetQueue.addBulk(jobs);
    logger.info("[marksheet] enqueue(exam): queued student jobs", {
      examId,
      count: jobs.length,
    });
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
  static async ensureQueuedForExamIfDue(examId: number): Promise<number> {
    const now = Date.now();
    const last = ensureQueuedLastRun.get(examId) ?? 0;
    if (now - last < ENSURE_QUEUED_COOLDOWN_MS) {
      return this.requeueOrphanedPendingForExam(examId);
    }
    ensureQueuedLastRun.set(examId, now);
    return this.ensureQueuedForExam(examId);
  }

  /** Re-attach Bull jobs for DB pending/failed rows only (no gap-fill invalidate). */
  private static async requeueOrphanedPendingForExam(
    examId: number,
  ): Promise<number> {
    const pendingStudents = await prisma.marksheet_files.findMany({
      where: { exam_id: examId, status: { in: ["pending", "failed"] } },
      select: {
        student_id: true,
        exam_id: true,
        exam_name: true,
        year: true,
        school_id: true,
      },
    });
    let queued = 0;
    for (const r of pendingStudents) {
      const didAdd = await ensureJobQueued(
        {
          studentId: r.student_id,
          examId: r.exam_id,
          examName: r.exam_name,
          year: r.year,
          schoolId: r.school_id,
        },
        jobId(r.exam_id, r.student_id),
      );
      if (didAdd) queued++;
    }
    queued += await this.ensureBundlesQueuedForExam(examId);
    if (queued > 0) {
      logger.info("[marksheet] ensureQueued: orphan pending re-attached", {
        examId,
        count: queued,
      });
    }
    return queued;
  }

  static async ensureQueuedForExam(examId: number): Promise<number> {
    const exam = await prisma.exams.findUnique({
      where: { id: examId },
      select: { school_id: true, exam_name: true },
    });
    // Visible does not gate generation — only result_date freeze does.
    if (!exam?.school_id) return 0;

    const marks = await prisma.marks.findMany({
      where: { exam_id: examId, marks: { not: null } },
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
    if (studentIds.length === 0) {
      return this.ensureBundlesQueuedForExam(examId);
    }

    const existing = await prisma.marksheet_files.findMany({
      where: { exam_id: examId, student_id: { in: studentIds } },
      select: { student_id: true, status: true },
    });
    const statusByStudent = new Map(
      existing.map((r) => [r.student_id, r.status]),
    );

    const needQueue = studentIds.filter((sid) => {
      const st = statusByStudent.get(sid);
      if (!st) return true;
      if (st === "failed") return true;
      return st !== "ready" && st !== "pending" && st !== "generating";
    });

    let queued = 0;
    if (needQueue.length > 0) {
      await this.invalidate(needQueue, examId);
      queued += needQueue.length;
      logger.info("[marksheet] ensureQueued: gap-fill for exam", {
        examId,
        count: needQueue.length,
      });
    }

    // Pending rows whose Bull job was lost (stall / restart) never leave pending
    // unless we re-add them — invalidate() skips status===pending.
    const pendingStudents = await prisma.marksheet_files.findMany({
      where: {
        exam_id: examId,
        student_id: { in: studentIds },
        status: { in: ["pending", "failed"] },
      },
      select: {
        student_id: true,
        exam_id: true,
        exam_name: true,
        year: true,
        school_id: true,
      },
    });
    for (const r of pendingStudents) {
      const didAdd = await ensureJobQueued(
        {
          studentId: r.student_id,
          examId: r.exam_id,
          examName: r.exam_name,
          year: r.year,
          schoolId: r.school_id,
        },
        jobId(r.exam_id, r.student_id),
      );
      if (didAdd) queued++;
    }

    queued += await this.ensureBundlesQueuedForExam(examId);
    return queued;
  }

  /**
   * Re-queue class bundles stuck in pending/failed (or orphaned generating)
   * when their Bull job is missing — otherwise status stays pending forever.
   */
  private static async ensureBundlesQueuedForExam(
    examId: number,
  ): Promise<number> {
    // Orphaned generating: worker died after claim, job gone from Redis.
    const generating = await prisma.marksheet_bundles.findMany({
      where: { exam_id: examId, status: "generating" },
      select: {
        exam_id: true,
        exam_name: true,
        year: true,
        class: true,
        section: true,
        school_id: true,
      },
    });
    for (const row of generating) {
      const id = bundleJobId(row.exam_id, row.class, row.section);
      const job = await marksheetQueue.getJob(id);
      const state = job ? await job.getState() : null;
      if (state === "active") continue;
      await prisma.marksheet_bundles.updateMany({
        where: {
          exam_id: row.exam_id,
          class: row.class,
          section: row.section,
          status: "generating",
        },
        data: { status: "pending", error: null },
      });
    }

    const pendingBundles = await prisma.marksheet_bundles.findMany({
      where: {
        exam_id: examId,
        OR: [
          { status: "pending" },
          { status: "failed", attempts: { lt: MAX_BUNDLE_ATTEMPTS } },
        ],
      },
      select: {
        exam_id: true,
        exam_name: true,
        year: true,
        class: true,
        section: true,
        school_id: true,
      },
    });
    if (pendingBundles.length === 0) return 0;

    let added = 0;
    for (const r of pendingBundles) {
      const didAdd = await ensureJobQueued(
        {
          kind: "bundle",
          examId: r.exam_id,
          examName: r.exam_name,
          year: r.year,
          class: r.class,
          schoolId: r.school_id,
          bundleSection: r.section,
        },
        bundleJobId(r.exam_id, r.class, r.section),
      );
      if (didAdd) added++;
    }
    if (added > 0) {
      logger.info("[marksheet] ensureQueued: re-queued pending bundles", {
        examId,
        count: added,
      });
    }
    return added;
  }

  /** Students with at least one non-null mark for this exam. */
  private static async studentIdsWithMarksForExam(
    examId: number,
    studentIds: number[],
  ): Promise<number[]> {
    if (studentIds.length === 0) return [];
    const rows = await prisma.marks.findMany({
      where: {
        exam_id: examId,
        marks: { not: null },
        enrollment: { student_id: { in: studentIds } },
      },
      distinct: ["enrollment_id"],
      select: { enrollment: { select: { student_id: true } } },
    });
    return [
      ...new Set(
        rows
          .map((r) => r.enrollment?.student_id)
          .filter((id): id is number => id != null),
      ),
    ];
  }


  /**
   * Re-queue class bundles when marks change for the given students.
   * Upserts ALL + each affected section (+ existing composite keys) to pending
   * and enqueues Bull jobs — same shape as teacher/head bundle invalidation.
   */
  private static async enqueueBundlesForStudents(
    examId: number,
    examName: string,
    year: number,
    schoolId: number,
    studentIds: number[],
    priority = PRIORITY_BACKFILL,
  ): Promise<void> {
    if (studentIds.length === 0) return;
    const enrollments = await prisma.student_enrollments.findMany({
      where: { student_id: { in: studentIds }, year },
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
      const existing = await prisma.marksheet_bundles.findMany({
        where: { exam_id: examId, class: className },
        select: { section: true },
      });
      const existingSections = existing.map((r) => r.section);
      const keys = new Set<string>(["ALL", ...existingSections]);
      for (const section of sections) {
        for (const k of this.bundleSectionsForTeacherChange(
          section,
          existingSections,
        )) {
          keys.add(k);
        }
      }

      for (const bundleSection of keys) {
        await prisma.marksheet_bundles.upsert({
          where: {
            exam_id_class_section: {
              exam_id: examId,
              class: className,
              section: bundleSection,
            },
          },
          create: {
            exam_id: examId,
            exam_name: examName,
            year,
            class: className,
            section: bundleSection,
            school_id: schoolId,
            status: "pending",
          },
          update: {
            status: "pending",
            error: null,
            exam_name: examName,
            input_hash: null,
          },
        });
        jobs.push({
          data: {
            kind: "bundle" as const,
            examId,
            examName,
            year,
            class: className,
            schoolId,
            bundleSection,
          },
          opts: {
            jobId: bundleJobId(examId, className, bundleSection),
            ...defaultJobOpts(priority),
          },
        });
      }
    }

    if (jobs.length > 0) {
      await marksheetQueue.addBulk(jobs);
      logger.info("[marksheet] enqueue(bundles): mark edit", {
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
  private static async enqueueSessionsForStudents(
    studentIds: number[],
    year: number,
    schoolId: number,
    priority = PRIORITY_BACKFILL,
  ): Promise<void> {
    if (studentIds.length === 0) return;

    const uniqueIds = [...new Set(studentIds)];
    const sessionStudentIds = [
      this.SESSION_YEAR_STUDENT_ID,
      ...uniqueIds,
    ];

    for (const studentId of sessionStudentIds) {
      await prisma.marksheet_sessions.upsert({
        where: {
          marksheet_session_scope: {
            school_id: schoolId,
            year,
            student_id: studentId,
          },
        },
        create: {
          school_id: schoolId,
          year,
          student_id: studentId,
          status: "pending",
        },
        update: { status: "pending", error: null, input_hash: null },
      });
    }

    await marksheetQueue.addBulk([
      {
        data: {
          kind: "session-year" as const,
          year,
          schoolId,
        },
        opts: {
          jobId: sessionYearJobId(year),
          ...defaultJobOpts(priority),
        },
      },
      ...uniqueIds.map((studentId) => ({
        data: {
          kind: "session-student" as const,
          studentId,
          year,
          schoolId,
        },
        opts: {
          jobId: sessionStudentJobId(year, studentId),
          ...defaultJobOpts(priority),
        },
      })),
    ]);

    logger.info("[marksheet] enqueue(sessions): mark edit", {
      year,
      schoolId,
      students: uniqueIds.length,
      sessionYear: true,
    });
  }

  /**
   * Mark the given students' sheets stale and re-enqueue. Only students with
   * real marks for this exam are queued — never creates duplicate/skipped rows.
   * Also auto-queues affected class bundles and session PDFs.
   */
  static async invalidate(
    studentIds: number[],
    examId: number,
    priority = PRIORITY_BACKFILL,
  ): Promise<void> {
    if (studentIds.length === 0) return;
    const exam = await prisma.exams.findUnique({
      where: { id: examId },
      select: {
        school_id: true,
        exam_name: true,
        exam_year: true,
        result_date: true,
      },
    });
    if (!exam?.school_id) return;

    const eligible = await this.studentIdsWithMarksForExam(examId, studentIds);
    if (eligible.length === 0) return;

    // Drop cache rows for students who have no marks for this exam.
    const ineligible = studentIds.filter((id) => !eligible.includes(id));
    if (ineligible.length > 0) {
      await prisma.marksheet_files.deleteMany({
        where: {
          exam_id: examId,
          student_id: { in: ineligible },
          status: { in: ["skipped", "pending", "failed"] },
        },
      });
    }

    logger.info("[marksheet] invalidate(students): flagging stale + re-queue", {
      examId,
      count: eligible.length,
    });
    await this.enqueueBundlesForStudents(
      examId,
      exam.exam_name,
      exam.exam_year,
      exam.school_id,
      eligible,
      priority,
    );
    await this.enqueueSessionsForStudents(
      eligible,
      exam.exam_year,
      exam.school_id,
      priority,
    );
    await prisma.marksheet_files.updateMany({
      where: { exam_id: examId, student_id: { in: eligible } },
      data: { status: "pending", error: null },
    });

    const existing = await prisma.marksheet_files.findMany({
      where: { exam_id: examId, student_id: { in: eligible } },
      select: { student_id: true },
    });
    const have = new Set(existing.map((r) => r.student_id));
    const missing = eligible.filter((id) => !have.has(id));
    if (missing.length > 0) {
      await prisma.marksheet_files
        .createMany({
          data: missing.map((id) => ({
            student_id: id,
            exam_id: examId,
            exam_name: exam.exam_name,
            year: exam.exam_year,
            school_id: exam.school_id!,
            status: "pending",
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
      await this.seedOpenSnapshot(eligible, examId, exam.exam_year);
    }

    await marksheetQueue.addBulk(
      eligible.map((id) => ({
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
  }

  /**
   * Re-queue per-student sheets and class bundles after a class-teacher
   * assignment (levels) or teacher identity change affecting that section.
   */
  static async invalidateForClassSection(
    className: number,
    section: string,
    year: number,
  ): Promise<void> {
    logger.info(
      "[marksheet] invalidate(class-section): assignment/signature changed",
      { class: className, section, year },
    );

    const studentIds = (
      await prisma.student_enrollments.findMany({
        where: { class: className, section, year },
        select: { student_id: true },
      })
    ).map((e) => e.student_id);

    const examRows = studentIds.length
      ? await prisma.marks.findMany({
          where: {
            enrollment: { student_id: { in: studentIds }, year },
            marks: { not: null },
          },
          distinct: ["exam_id"],
          select: {
            exam_id: true,
            exam: {
              select: {
                exam_name: true,
                school_id: true,
                exam_year: true,
                result_date: true,
              },
            },
          },
        })
      : await prisma.marksheet_bundles.findMany({
          where: { class: className, year, section: { in: [section, "ALL"] } },
          distinct: ["exam_id"],
          select: {
            exam_id: true,
            exam_name: true,
            school_id: true,
            year: true,
          },
        }).then((rows) =>
          rows.map((r) => ({
            exam_id: r.exam_id,
            exam: {
              exam_name: r.exam_name,
              school_id: r.school_id,
              exam_year: r.year,
            },
          })),
        );

    for (const row of examRows) {
      const exam = row.exam;
      const schoolId = exam?.school_id;
      const examName = exam?.exam_name;
      if (!schoolId || !examName) continue;

      // Skip frozen exams: reassigning a class teacher must not regenerate a
      // finalized sheet. The snapshotted signatory keeps it stable, and a
      // same-person signature upload is picked up lazily on next download.
      let resultDate = (exam as { result_date?: string | null }).result_date;
      if (resultDate === undefined) {
        resultDate =
          (
            await prisma.exams.findUnique({
              where: { id: row.exam_id },
              select: { result_date: true },
            })
          )?.result_date ?? null;
      }
      if (isExamFrozen(resultDate)) continue;

      const examStudentIds = await this.studentIdsWithMarksForExam(
        row.exam_id,
        studentIds,
      );
      if (examStudentIds.length > 0) {
        await this.invalidate(examStudentIds, row.exam_id);
      }
      await this.invalidateBundlesForClassSection(
        row.exam_id,
        className,
        year,
        section,
        examName,
        schoolId,
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
  static async invalidateForSchoolSignatureChange(
    schoolId: number,
  ): Promise<void> {
    await this.invalidateOpenExamCaches(schoolId, "head identity changed");
  }

  /**
   * Re-queue open-exam marksheets after a PDF layout / design change.
   * Same freeze rule as head changes: finalized (result_date passed) sheets
   * keep their design. Prefer bumping MARKSHEET_DESIGN_VERSION — startup
   * compares DB `snapshot_design_version` and mass-enqueues outdated open sheets.
   */
  static async invalidateForDesignChange(schoolId: number): Promise<void> {
    await this.invalidateOpenExamCaches(schoolId, "layout version bumped", {
      designVersion: MARKSHEET_DESIGN_VERSION,
    });
  }

  /**
   * On deploy/boot: enqueue open-exam files/bundles whose
   * `snapshot_design_version` is missing or ≠ MARKSHEET_DESIGN_VERSION.
   * Frozen exams skipped. Idempotent — once rows are regenerated with the
   * current version, later boots find nothing outdated.
   */
  static async applyDesignVersionBumpIfNeeded(): Promise<void> {
    const schools = await prisma.school.findMany({ select: { id: true } });
    let outdatedStudents = 0;
    let outdatedBundles = 0;

    for (const { id: schoolId } of schools) {
      const counts = await runWithRlsContext(
        { schoolId, isSuperAdmin: false },
        () => this.enqueueOutdatedDesignForSchool(schoolId),
      );
      outdatedStudents += counts.students;
      outdatedBundles += counts.bundles;
    }

    if (outdatedStudents === 0 && outdatedBundles === 0) {
      logger.info("[marksheet] design bump: all open caches current", {
        version: MARKSHEET_DESIGN_VERSION,
      });
      return;
    }

    logger.info("[marksheet] design bump: enqueued outdated open caches", {
      version: MARKSHEET_DESIGN_VERSION,
      students: outdatedStudents,
      bundles: outdatedBundles,
      schools: schools.length,
    });
  }

  /** Enqueue open-exam rows for one school that are behind MARKSHEET_DESIGN_VERSION. */
  private static async enqueueOutdatedDesignForSchool(
    schoolId: number,
  ): Promise<{ students: number; bundles: number }> {
    const exams = await prisma.exams.findMany({
      where: { school_id: schoolId },
      select: { id: true, result_date: true },
    });
    const openExamIds = exams
      .filter((e) => !isExamFrozen(e.result_date))
      .map((e) => e.id);
    if (openExamIds.length === 0) return { students: 0, bundles: 0 };

    const outdatedWhere = {
      school_id: schoolId,
      exam_id: { in: openExamIds },
      status: { in: ["ready", "failed"] },
      OR: [
        { snapshot_design_version: null },
        { snapshot_design_version: { not: MARKSHEET_DESIGN_VERSION } },
      ],
    };

    const [outdatedFiles, outdatedBundleRows] = await Promise.all([
      prisma.marksheet_files.findMany({
        where: outdatedWhere,
        select: {
          student_id: true,
          exam_id: true,
          exam_name: true,
          year: true,
        },
      }),
      prisma.marksheet_bundles.findMany({
        where: outdatedWhere,
        select: {
          exam_id: true,
          exam_name: true,
          year: true,
          class: true,
          section: true,
        },
      }),
    ]);

    if (outdatedFiles.length === 0 && outdatedBundleRows.length === 0) {
      return { students: 0, bundles: 0 };
    }

    if (outdatedFiles.length > 0) {
      await prisma.marksheet_files.updateMany({
        where: {
          school_id: schoolId,
          exam_id: { in: openExamIds },
          student_id: { in: outdatedFiles.map((r) => r.student_id) },
          status: { in: ["ready", "failed"] },
          OR: [
            { snapshot_design_version: null },
            { snapshot_design_version: { not: MARKSHEET_DESIGN_VERSION } },
          ],
        },
        data: { status: "pending", error: null },
      });
      await marksheetQueue.addBulk(
        outdatedFiles.map((r) => ({
          data: {
            studentId: r.student_id,
            examId: r.exam_id,
            examName: r.exam_name,
            year: r.year,
            schoolId,
          },
          opts: {
            jobId: jobId(r.exam_id, r.student_id),
            ...defaultJobOpts(PRIORITY_BACKFILL),
          },
        })),
      );
    }

    if (outdatedBundleRows.length > 0) {
      await prisma.marksheet_bundles.updateMany({
        where: {
          school_id: schoolId,
          exam_id: { in: openExamIds },
          status: { in: ["ready", "failed"] },
          OR: [
            { snapshot_design_version: null },
            { snapshot_design_version: { not: MARKSHEET_DESIGN_VERSION } },
          ],
        },
        data: { status: "pending", error: null },
      });
      await marksheetQueue.addBulk(
        outdatedBundleRows.map((r) => ({
          data: {
            kind: "bundle" as const,
            examId: r.exam_id,
            examName: r.exam_name,
            year: r.year,
            class: r.class,
            schoolId,
            bundleSection: r.section,
          },
          opts: {
            jobId: bundleJobId(r.exam_id, r.class, r.section),
            ...defaultJobOpts(PRIORITY_BACKFILL),
          },
        })),
      );
    }

    return {
      students: outdatedFiles.length,
      bundles: outdatedBundleRows.length,
    };
  }

  /** Flag ready/failed open-exam files+bundles pending and enqueue workers. */
  private static async invalidateOpenExamCaches(
    schoolId: number,
    reason: string,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    logger.info(`[marksheet] invalidate(school): ${reason}`, {
      schoolId,
      ...extra,
    });

    const exams = await prisma.exams.findMany({
      where: { school_id: schoolId },
      select: { id: true, result_date: true },
    });
    const openExamIds = exams
      .filter((e) => !isExamFrozen(e.result_date))
      .map((e) => e.id);

    if (openExamIds.length === 0) {
      logger.info(
        "[marksheet] invalidate(school): all exams frozen, nothing to re-queue",
        { schoolId, reason },
      );
      return;
    }

    await prisma.marksheet_files.updateMany({
      where: {
        school_id: schoolId,
        exam_id: { in: openExamIds },
        status: { in: ["ready", "failed"] },
      },
      data: { status: "pending", error: null },
    });

    const pendingStudents = await prisma.marksheet_files.findMany({
      where: {
        school_id: schoolId,
        exam_id: { in: openExamIds },
        status: "pending",
      },
      select: {
        student_id: true,
        exam_id: true,
        exam_name: true,
        year: true,
      },
    });

    if (pendingStudents.length > 0) {
      await marksheetQueue.addBulk(
        pendingStudents.map((r) => ({
          data: {
            studentId: r.student_id,
            examId: r.exam_id,
            examName: r.exam_name,
            year: r.year,
            schoolId,
          },
          opts: {
            jobId: jobId(r.exam_id, r.student_id),
            ...defaultJobOpts(PRIORITY_BACKFILL),
          },
        })),
      );
    }

    await prisma.marksheet_bundles.updateMany({
      where: {
        school_id: schoolId,
        exam_id: { in: openExamIds },
        status: { in: ["ready", "failed"] },
      },
      data: { status: "pending", error: null },
    });

    const pendingBundles = await prisma.marksheet_bundles.findMany({
      where: {
        school_id: schoolId,
        exam_id: { in: openExamIds },
        status: "pending",
      },
      select: {
        exam_id: true,
        exam_name: true,
        year: true,
        class: true,
        section: true,
      },
    });

    if (pendingBundles.length > 0) {
      await marksheetQueue.addBulk(
        pendingBundles.map((r) => ({
          data: {
            kind: "bundle" as const,
            examId: r.exam_id,
            examName: r.exam_name,
            year: r.year,
            class: r.class,
            schoolId,
            bundleSection: r.section,
          },
          opts: {
            jobId: bundleJobId(r.exam_id, r.class, r.section),
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
  static async invalidateForTeacherProfile(teacherId: number): Promise<void> {
    const levels = await prisma.levels.findMany({
      where: { teacher_id: teacherId },
      select: { class_name: true, section: true, year: true },
    });

    for (const lv of levels) {
      await this.invalidateForClassSection(lv.class_name, lv.section, lv.year);
    }

    const headRows = await prisma.head_msg.findMany({
      where: { head_id: teacherId },
      select: { school_id: true },
    });

    for (const row of headRows) {
      if (row.school_id) {
        await this.invalidateForSchoolSignatureChange(row.school_id);
      }
    }
  }

  private static bundleSectionsForTeacherChange(
    section: string,
    existingSections: string[],
  ): string[] {
    const keys = new Set<string>([section, "ALL"]);
    for (const s of existingSections) {
      if (s === section || s === "ALL") {
        keys.add(s);
        continue;
      }
      if (s.includes("+") && s.split("+").includes(section)) {
        keys.add(s);
      }
    }
    return [...keys];
  }

  /** Re-queue class bundle PDFs affected by a section's teacher change. */
  private static async invalidateBundlesForClassSection(
    examId: number,
    className: number,
    year: number,
    section: string,
    examName: string,
    schoolId: number,
  ): Promise<void> {
    const existing = await prisma.marksheet_bundles.findMany({
      where: { exam_id: examId, class: className },
      select: { section: true },
    });

    const bundleSections = this.bundleSectionsForTeacherChange(
      section,
      existing.map((r) => r.section),
    );

    for (const bundleSection of bundleSections) {
      await prisma.marksheet_bundles.upsert({
        where: {
          exam_id_class_section: {
            exam_id: examId,
            class: className,
            section: bundleSection,
          },
        },
        create: {
          exam_id: examId,
          exam_name: examName,
          year,
          class: className,
          section: bundleSection,
          school_id: schoolId,
          status: "pending",
        },
        update: { status: "pending", error: null, exam_name: examName },
      });
    }

    await marksheetQueue.addBulk(
      bundleSections.map((bundleSection) => ({
        data: {
          kind: "bundle" as const,
          examId,
          examName,
          year,
          class: className,
          schoolId,
          bundleSection,
        },
        opts: {
          jobId: bundleJobId(examId, className, bundleSection),
          ...defaultJobOpts(PRIORITY_BACKFILL),
        },
      })),
    );
  }

  /** Status breakdown for an exam, for admin progress UI. */
  static async statusCounts(examId: number): Promise<any> {
    // Remove orphan skipped rows (students without marks for this exam).
    await prisma.marksheet_files.deleteMany({
      where: { exam_id: examId, status: "skipped" },
    });

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
      total:
        rawStudents.ready +
        rawStudents.pending +
        rawStudents.generating +
        rawStudents.failed,
      done: rawStudents.ready,
    };
    const bundles = tally(bundleGrouped);
    bundles.total =
      bundles.ready +
      bundles.pending +
      bundles.generating +
      bundles.failed;
    const staleBundles = await this.listStaleBundles(examId);
    const failedBundles = await prisma.marksheet_bundles.findMany({
      where: { exam_id: examId, status: "failed" },
      select: { class: true, section: true, error: true },
      orderBy: [{ class: "asc" }, { section: "asc" }],
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

  /**
   * Ready bundle rows that need regen. Once a live-hash mismatch is seen we
   * clear `input_hash` so the row stays "stale" across polls until download
   * regenerates it — without that pin, a flaky fingerprint (or a concurrent
   * regen) can make staleItems thrash request-to-request.
   */
  private static async listStaleBundles(
    examId: number,
  ): Promise<{ class: number; section: string }[]> {
    const rows = await prisma.marksheet_bundles.findMany({
      where: { exam_id: examId, status: "ready" },
      select: {
        id: true,
        class: true,
        section: true,
        year: true,
        input_hash: true,
      },
      orderBy: [{ class: "asc" }, { section: "asc" }],
    });
    if (rows.length === 0) return [];

    const stale: { class: number; section: string }[] = [];
    const pinIds: number[] = [];

    for (const row of rows) {
      if (!row.input_hash) {
        stale.push({ class: row.class, section: row.section });
        continue;
      }
      const liveHash = await this.computeBundleHash(
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
      await prisma.marksheet_bundles.updateMany({
        where: { id: { in: pinIds } },
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
  private static deferStudentRequeue(job: StudentJob): void {
    const id = jobId(job.examId, job.studentId);
    setImmediate(() => {
      ensureJobQueuedAfterDefer(job, id, PRIORITY_BACKFILL).then((ok) => {
        if (!ok) {
          logger.warn("[marksheet] requeue(student) still not queued after retries", {
            studentId: job.studentId,
            examId: job.examId,
          });
        }
      });
    });
  }

  private static deferBundleRequeue(job: BundleJob, delayMs = 0): void {
    const bundleSection = this.bundleSectionKey(job.bundleSection);
    const id = bundleJobId(job.examId, job.class, bundleSection);
    const run = () => {
      ensureJobQueuedAfterDefer(
        { ...job, kind: "bundle", bundleSection },
        id,
        PRIORITY_BACKFILL,
      ).then((ok) => {
        if (!ok) {
          logger.warn("[marksheet] requeue(bundle) still not queued after retries", {
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
  private static async studentJobStale(
    studentId: number,
    examId: number,
    year: number,
    hashAtStart: string,
  ): Promise<boolean> {
    const [hashAtEnd, row] = await Promise.all([
      this.computeInputHash(studentId, examId, year),
      prisma.marksheet_files.findUnique({
        where: { student_id_exam_id: { student_id: studentId, exam_id: examId } },
        select: { status: true },
      }),
    ]);
    return hashAtEnd !== hashAtStart || row?.status !== "generating";
  }

  private static async bundleJobStale(
    examId: number,
    cls: number,
    year: number,
    bundleSection: string,
    hashAtStart: string,
  ): Promise<boolean> {
    const [hashAtEnd, row] = await Promise.all([
      this.computeBundleHash(examId, cls, year, bundleSection),
      prisma.marksheet_bundles.findUnique({
        where: {
          exam_id_class_section: {
            exam_id: examId,
            class: cls,
            section: bundleSection,
          },
        },
        select: { status: true },
      }),
    ]);
    return hashAtEnd !== hashAtStart || row?.status !== "generating";
  }

  /** Queue entrypoint: dispatch to the student, bundle, or session processor. */
  static async processJob(job: MarksheetJob): Promise<void> {
    if (job.kind === "bundle") {
      return this.processBundleJob(job);
    }
    if (job.kind === "session-student") {
      return this.processSessionStudentJob(job);
    }
    if (job.kind === "session-year") {
      return this.processSessionYearJob(job);
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

        const whereStudent = {
          student_id_exam_id: { student_id: studentId, exam_id: examId },
        };
        try {
          const [row, exam] = await Promise.all([
            prisma.marksheet_files.findUnique({
              where: whereStudent,
              select: {
                input_hash: true,
                r2_key: true,
                snapshot_head_id: true,
                snapshot_head_role: true,
                snapshot_teacher_id: true,
                snapshot_signatory_detail: true,
              },
            }),
            prisma.exams.findUnique({
              where: { id: examId },
              select: { result_date: true },
            }),
          ]);
          const frozen = isExamFrozen(exam?.result_date);
          let signatoryDetail = this.parseSignatoryDetail(
            row?.snapshot_signatory_detail,
          );

          // Legacy frozen rows: capture name/sig/phone once before hashing so
          // history pins without a live↔detail hash flap.
          if (
            frozen &&
            row &&
            (row.snapshot_head_id != null || row.snapshot_teacher_id != null) &&
            !signatoryDetail
          ) {
            const [headLive, teacherLive] = await Promise.all([
              this.headFingerprintById(
                row.snapshot_head_id,
                row.snapshot_head_role,
              ),
              row.snapshot_teacher_id != null
                ? prisma.teachers.findUnique({
                    where: { id: row.snapshot_teacher_id },
                    select: {
                      id: true,
                      name: true,
                      signature: true,
                      phone: true,
                    },
                  })
                : Promise.resolve(null),
            ]);
            signatoryDetail = await this.captureStudentSignatoryDetail(
              schoolId,
              examId,
              {
                id: headLive.id,
                role: headLive.role,
                name: headLive.name,
                signature: headLive.sig,
              },
              teacherLive
                ? {
                    id: teacherLive.id,
                    name: teacherLive.name,
                    signature: teacherLive.signature,
                    phone: teacherLive.phone,
                  }
                : null,
            );
            await prisma.marksheet_files.update({
              where: whereStudent,
              data: { snapshot_signatory_detail: signatoryDetail },
            });
          }

          const hashAtStart = await this.computeInputHash(
            studentId,
            examId,
            year,
          );

          const frozenSignatories =
            frozen &&
            row &&
            (row.snapshot_head_id != null || row.snapshot_teacher_id != null)
              ? {
                  headId: row.snapshot_head_id,
                  headRole: row.snapshot_head_role,
                  teacherId: row.snapshot_teacher_id,
                  detail: signatoryDetail,
                }
              : undefined;
          // Nothing changed and the object is still there — no render needed.
          if (
            row?.input_hash === hashAtStart &&
            row.r2_key &&
            (await headObject(row.r2_key))
          ) {
            if (await this.studentJobStale(studentId, examId, year, hashAtStart)) {
              await prisma.marksheet_files.update({
                where: whereStudent,
                data: { status: "pending", error: null },
              });
              this.deferStudentRequeue(job);
              logger.info("[marksheet] job(student): DEFER after skip (concurrent edit)", {
                studentId,
                examId,
                ms: Date.now() - t0,
              });
              return;
            }
            await prisma.marksheet_files.update({
              where: whereStudent,
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
              : row.input_hash !== hashAtStart
                ? "inputs-changed"
                : "r2-missing",
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
          } = await MarksService.generateMarksheetPDF(
            String(studentId),
            String(year),
            examName,
            WORKER_USER,
            frozenSignatories,
          );
          const key = this.r2Key(schoolId, year, examId, studentId);
          await uploadToR2(key, buffer);

          const detailToStore = await this.captureStudentSignatoryDetail(
            schoolId,
            examId,
            {
              id: usedHeadId,
              role: usedHeadRole,
              name: usedHeadName,
              signature: usedHeadSignature,
            },
            {
              id: usedTeacherId,
              name: usedTeacherName,
              signature: usedTeacherSignature,
              phone: usedTeacherPhone,
            },
          );
          // Persist detail before end-hash so frozen fingerprints stay stable.
          await prisma.marksheet_files.update({
            where: whereStudent,
            data: {
              snapshot_head_id: usedHeadId,
              snapshot_head_role: usedHeadRole,
              snapshot_teacher_id: usedTeacherId,
              snapshot_signatory_detail: detailToStore,
              snapshot_design_version: MARKSHEET_DESIGN_VERSION,
            },
          });

          const hashAtEnd = await this.computeInputHash(studentId, examId, year);
          const afterRender = await prisma.marksheet_files.findUnique({
            where: whereStudent,
            select: { status: true },
          });
          if (
            hashAtEnd !== hashAtStart ||
            afterRender?.status !== "generating"
          ) {
            await prisma.marksheet_files.update({
              where: whereStudent,
              data: { status: "pending", error: null },
            });
            this.deferStudentRequeue(job);
            logger.info("[marksheet] job(student): DEFER after render (concurrent edit)", {
              studentId,
              examId,
              key,
              bytes: buffer.length,
              ms: Date.now() - t0,
            });
            return;
          }

          await prisma.marksheet_files.update({
            where: whereStudent,
            data: {
              status: "ready",
              r2_key: key,
              input_hash: hashAtEnd,
              student_name: studentName,
              snapshot_head_id: usedHeadId,
              snapshot_head_role: usedHeadRole,
              snapshot_teacher_id: usedTeacherId,
              snapshot_signatory_detail: detailToStore,
              snapshot_design_version: MARKSHEET_DESIGN_VERSION,
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
          if (isNoMarks) {
            await prisma.marksheet_files
              .delete({
                where: {
                  student_id_exam_id: { student_id: studentId, exam_id: examId },
                },
              })
              .catch(() => {});
            logger.info("[marksheet] job(student): SKIPPED (no marks)", {
              studentId,
              examId,
            });
            return;
          }
          await prisma.marksheet_files
            .update({
              where: {
                student_id_exam_id: { student_id: studentId, exam_id: examId },
              },
              data: {
                status: "failed",
                error: message,
              },
            })
            .catch(() => {});
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
    bundleSection = "ALL",
  ): string {
    const sectionPart =
      bundleSection === "ALL"
        ? "all"
        : encodeURIComponent(bundleSection).replace(/%/g, "_");
    return `${schoolId}/marksheets/${year}/bundles/${examId}/class-${cls}-${sectionPart}.pdf`;
  }

  /** Fingerprint of a class's marks + stats for bundle staleness checks. */
  static async computeBundleHash(
    examId: number,
    cls: number,
    year: number,
    bundleSection = "ALL",
  ): Promise<string> {
    const enrollmentWhere = this.enrollmentWhereForBundleSection(
      cls,
      year,
      bundleSection,
    );
    const bundleSections = this.parseBundleSections(bundleSection);

    const [exam, snapRow] = await Promise.all([
      prisma.exams.findUnique({
        where: { id: examId },
        select: {
          exam_name: true,
          result_date: true,
          return_date: true,
          school_id: true,
          visible: true,
        },
      }),
      prisma.marksheet_bundles.findUnique({
        where: {
          exam_id_class_section: {
            exam_id: examId,
            class: cls,
            section: bundleSection,
          },
        },
        select: {
          snapshot_head_id: true,
          snapshot_head_role: true,
          snapshot_teachers: true,
          snapshot_signatory_detail: true,
          snapshot_design_version: true,
          school_id: true,
        },
      }),
    ]);
    const snapTeachers = (snapRow?.snapshot_teachers ?? null) as unknown as Record<
      string,
      number
    > | null;
    const frozen = isExamFrozen(exam?.result_date);
    const signatoryDetail = this.parseSignatoryDetail(
      snapRow?.snapshot_signatory_detail,
    );
    const useSnapshot =
      frozen &&
      !!snapRow &&
      (snapRow.snapshot_head_id != null ||
        (snapTeachers != null && Object.keys(snapTeachers).length > 0));
    const useFrozenDetail = useSnapshot && !!signatoryDetail;

    const frozenTeachersFp =
      useFrozenDetail && snapTeachers
        ? Object.entries(snapTeachers)
            .sort(([a], [b]) => a.localeCompare(b))
            .flatMap(([sec, id]) =>
              this.frozenTeacherFingerprint(sec, id, {
                teachers: signatoryDetail?.teachers,
              }),
            )
        : null;

    const [markAgg, stats, head, classTeachers, school, memberNames] =
      await Promise.all([
        prisma.marks.aggregate({
          where: { exam_id: examId, enrollment: enrollmentWhere },
          _max: { updated_at: true },
          _count: { _all: true },
        }),
        prisma.exam_class_stats.findFirst({
          where: { exam_id: examId, class: cls, year },
          select: { updated_at: true },
        }),
        useFrozenDetail
          ? Promise.resolve(
              this.frozenHeadFingerprint(
                snapRow!.snapshot_head_id,
                snapRow!.snapshot_head_role,
                signatoryDetail,
              ),
            )
          : useSnapshot
            ? this.headFingerprintById(
                snapRow!.snapshot_head_id,
                snapRow!.snapshot_head_role,
              )
            : this.headMsgFingerprint(),
        frozenTeachersFp
          ? Promise.resolve(frozenTeachersFp)
          : useSnapshot
            ? this.teacherFingerprintByIds(snapTeachers ?? {})
            : this.classTeacherFingerprint(cls, year, bundleSections),
        this.schoolFingerprintForExam(
          snapRow?.school_id ?? exam?.school_id ?? null,
          exam,
        ),
        prisma.student_enrollments.findMany({
          where: enrollmentWhere,
          select: { student: { select: { name: true } } },
          orderBy: [
            { section: "asc" },
            { roll: "asc" },
            { student: { name: "asc" } },
          ],
        }),
      ]);
    const fingerprint = JSON.stringify({
      sec: bundleSection,
      n: markAgg._count?._all ?? 0,
      m: isoStamp(markAgg._max?.updated_at),
      s: isoStamp(stats?.updated_at),
      h: head,
      t: classTeachers,
      sn: this.namesDigest(
        memberNames.map((e) => e.student?.name ?? ""),
      ),
      sch: school,
      en: exam?.exam_name ?? null,
      rd: exam?.result_date ?? null,
      retd: exam?.return_date ?? null,
      ...designFingerprint(frozen, snapRow?.snapshot_design_version),
    });
    return crypto.createHash("sha256").update(fingerprint).digest("hex");
  }

  static r2SessionStudentKey(
    schoolId: number,
    year: number,
    studentId: number,
  ): string {
    return `${schoolId}/marksheets/${year}/session/student-${studentId}.pdf`;
  }

  static r2SessionYearKey(schoolId: number, year: number): string {
    return `${schoolId}/marksheets/${year}/session/all.pdf`;
  }

  static async computeSessionStudentHash(
    studentId: number,
    year: number,
  ): Promise<string> {
    const enrollment = await prisma.student_enrollments.findFirst({
      where: { student_id: studentId, year },
      select: {
        roll: true,
        fourth_subject_id: true,
        class: true,
        section: true,
        school_id: true,
        student: { select: { name: true } },
      },
    });
    const [markAgg, head, classTeacher, school] = await Promise.all([
      prisma.marks.aggregate({
        where: { enrollment: { student_id: studentId, year } },
        _max: { updated_at: true },
        _count: { _all: true },
      }),
      this.headMsgFingerprint(),
      enrollment
        ? this.classTeacherFingerprint(enrollment.class, year, [
            enrollment.section,
          ])
        : Promise.resolve([]),
      this.schoolMarksheetFingerprint(
        enrollment?.school_id ?? getRlsContext()?.schoolId ?? null,
      ),
    ]);
    const fingerprint = JSON.stringify({
      n: markAgg._count?._all ?? 0,
      m: isoStamp(markAgg._max?.updated_at),
      h: head,
      t: classTeacher,
      r: enrollment?.roll ?? null,
      f: enrollment?.fourth_subject_id ?? null,
      nm: enrollment?.student?.name ?? null,
      sch: school,
      d: MARKSHEET_DESIGN_VERSION,
    });
    return crypto.createHash("sha256").update(fingerprint).digest("hex");
  }

  static async computeSessionYearHash(year: number): Promise<string> {
    const schoolId = getRlsContext()?.schoolId ?? null;
    const [markAgg, head, classTeachers, school, enrollments] =
      await Promise.all([
        prisma.marks.aggregate({
          where: { enrollment: { year } },
          _max: { updated_at: true },
          _count: { _all: true },
        }),
        this.headMsgFingerprint(),
        this.yearClassTeacherFingerprint(year),
        this.schoolMarksheetFingerprint(schoolId),
        prisma.student_enrollments.findMany({
          where: { year },
          select: { student: { select: { name: true } } },
          orderBy: [{ class: "asc" }, { section: "asc" }, { roll: "asc" }],
        }),
      ]);
    const fingerprint = JSON.stringify({
      n: markAgg._count?._all ?? 0,
      m: isoStamp(markAgg._max?.updated_at),
      h: head,
      t: classTeachers,
      sn: this.namesDigest(enrollments.map((e) => e.student?.name ?? "")),
      sch: school,
      d: MARKSHEET_DESIGN_VERSION,
    });
    return crypto.createHash("sha256").update(fingerprint).digest("hex");
  }

  /**
   * Serve a class exam bundle via worker + hash-verified R2 cache.
   * Bundles (admin ALL or one section, teacher section scope) generate on
   * download only — never pre-queued on publish or mark edits.
   */
  static async serveBundle(
    year: number,
    className: string,
    examName: string,
    user: any,
    sectionQuery?: string,
  ): Promise<BundleServeResult> {
    const cls = Number(className);
    const t0 = Date.now();
    logger.info("[marksheet] serveBundle: request", {
      class: cls,
      examName,
      year,
      role: user?.role,
      sectionQuery,
    });
    const exam = await prisma.exams.findFirst({
      where: { exam_name: examName, exam_year: year },
      select: { id: true, school_id: true },
    });
    if (!exam?.school_id) {
      throw new Error("Class marksheet cache is unavailable for this exam.");
    }

    const bundleSection = this.resolveBundleSection(
      user,
      cls,
      year,
      sectionQuery,
    );
    return this.waitForFreshBundlePdf(
      {
        kind: "bundle",
        examId: exam.id,
        examName,
        year,
        class: cls,
        schoolId: exam.school_id,
        bundleSection,
      },
      t0,
    );
  }

  /** Session marksheet for one student (all exams in a year). */
  static async serveSessionStudent(
    studentId: number,
    year: number,
    user: any,
  ): Promise<{ buffer: Buffer }> {
    const t0 = Date.now();
    await MarksService.verifyMarksheetDownloadAccess(
      studentId,
      year,
      "",
      user,
    );
    const enrollment = await prisma.student_enrollments.findFirst({
      where: { student_id: studentId, year },
      select: { school_id: true },
    });
    const schoolId =
      enrollment?.school_id ?? user?.school_id ?? user?.schoolId ?? null;
    if (!schoolId) {
      throw new Error("Session marksheet cache is unavailable.");
    }
    const hash = await this.computeSessionStudentHash(studentId, year);

    const tryServeFresh = async () => {
      const fresh = await this.isSessionCacheFresh(
        schoolId,
        year,
        studentId,
        hash,
      );
      if (!fresh) return null;
      const buf = await getFileBuffer(fresh.r2_key);
      return buf ? { buffer: buf } : null;
    };

    let fresh = await tryServeFresh();
    if (fresh) return fresh;

    await prisma.marksheet_sessions.upsert({
      where: {
        marksheet_session_scope: {
          school_id: schoolId,
          year,
          student_id: studentId,
        },
      },
      create: {
        school_id: schoolId,
        year,
        student_id: studentId,
        status: "pending",
      },
      update: { status: "pending", error: null, attempts: 0 },
    });

    const job: SessionStudentJob = {
      kind: "session-student",
      studentId,
      year,
      schoolId,
    };
    await enqueueUserPriority(job, sessionStudentJobId(year, studentId)).catch(
      () => {},
    );

    const deadline = Date.now() + SERVE_TIMEOUT_MS;
    while (Date.now() < deadline) {
      fresh = await tryServeFresh();
      if (fresh) {
        logger.info("[marksheet] serveSessionStudent: worker ready", {
          studentId,
          year,
          ms: Date.now() - t0,
        });
        return fresh;
      }
      await sleep(SERVE_POLL_MS);
    }
    throw new Error(
      "Session marksheet generation timed out. Please try again shortly.",
    );
  }

  /** All session marksheets for a school year (admin). */
  static async serveSessionYear(
    year: number,
    user: any,
  ): Promise<{ buffer: Buffer }> {
    if (user?.role !== "admin") {
      throw new Error("Only admins can download all session marksheets.");
    }
    const t0 = Date.now();
    const schoolId = user?.school_id;
    if (!schoolId) {
      throw new Error("Session marksheet cache is unavailable.");
    }

    const studentId = this.SESSION_YEAR_STUDENT_ID;
    const hash = await this.computeSessionYearHash(year);

    const tryServeFresh = async () => {
      const fresh = await this.isSessionCacheFresh(
        schoolId,
        year,
        studentId,
        hash,
      );
      if (!fresh) return null;
      const buf = await getFileBuffer(fresh.r2_key);
      return buf ? { buffer: buf } : null;
    };

    let fresh = await tryServeFresh();
    if (fresh) return fresh;

    await prisma.marksheet_sessions.upsert({
      where: {
        marksheet_session_scope: {
          school_id: schoolId,
          year,
          student_id: studentId,
        },
      },
      create: {
        school_id: schoolId,
        year,
        student_id: studentId,
        status: "pending",
      },
      update: { status: "pending", error: null, attempts: 0 },
    });

    const job: SessionYearJob = { kind: "session-year", year, schoolId };
    await enqueueUserPriority(job, sessionYearJobId(year)).catch(() => {});

    const deadline = Date.now() + SERVE_TIMEOUT_MS;
    while (Date.now() < deadline) {
      fresh = await tryServeFresh();
      if (fresh) {
        logger.info("[marksheet] serveSessionYear: worker ready", {
          year,
          ms: Date.now() - t0,
        });
        return fresh;
      }
      await sleep(SERVE_POLL_MS);
    }
    throw new Error(
      "Session marksheet generation timed out. Please try again shortly.",
    );
  }

  static async processSessionStudentJob(job: SessionStudentJob): Promise<void> {
    const { studentId, year, schoolId } = job;
    await runWithRlsContext(
      { schoolId, isSuperAdmin: false, inRlsTransaction: false },
      async () => {
        const whereKey = {
          marksheet_session_scope: {
            school_id: schoolId,
            year,
            student_id: studentId,
          },
        };
        await prisma.marksheet_sessions.upsert({
          where: whereKey,
          create: {
            school_id: schoolId,
            year,
            student_id: studentId,
            status: "generating",
            attempts: 1,
          },
          update: {
            status: "generating",
            attempts: { increment: 1 },
            error: null,
          },
        });

        try {
          const hashAtStart = await this.computeSessionStudentHash(
            studentId,
            year,
          );
          const existing = await prisma.marksheet_sessions.findUnique({
            where: whereKey,
            select: { input_hash: true, r2_key: true },
          });
          if (
            existing?.input_hash === hashAtStart &&
            existing.r2_key &&
            (await headObject(existing.r2_key))
          ) {
            await prisma.marksheet_sessions.update({
              where: whereKey,
              data: { status: "ready", error: null },
            });
            logger.info("[marksheet] job(session-student): SKIP render", {
              studentId,
              year,
            });
            return;
          }

          const buffer = await MarksService.generateAllMarksheetsPDF(
            String(year),
            String(studentId),
          );
          const key = this.r2SessionStudentKey(schoolId, year, studentId);
          const hashAtEnd = await this.computeSessionStudentHash(
            studentId,
            year,
          );
          if (hashAtEnd !== hashAtStart) {
            await prisma.marksheet_sessions.update({
              where: whereKey,
              data: { status: "pending", error: null },
            });
            setImmediate(() => {
              enqueueUserPriority(
                job,
                sessionStudentJobId(year, studentId),
              ).catch(() => {});
            });
            logger.info(
              "[marksheet] job(session-student): DEFER after render (concurrent edit)",
              { studentId, year, bytes: buffer.length },
            );
            return;
          }

          await uploadToR2(key, buffer);
          await prisma.marksheet_sessions.update({
            where: whereKey,
            data: {
              status: "ready",
              r2_key: key,
              input_hash: hashAtEnd,
              generated_at: new Date(),
              error: null,
            },
          });
          logger.info("[marksheet] job(session-student): READY", {
            studentId,
            year,
            bytes: buffer.length,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await prisma.marksheet_sessions
            .update({
              where: whereKey,
              data: { status: "failed", error: msg.slice(0, 500) },
            })
            .catch(() => {});
          throw e;
        }
      },
    );
  }

  static async processSessionYearJob(job: SessionYearJob): Promise<void> {
    const { year, schoolId } = job;
    const studentId = this.SESSION_YEAR_STUDENT_ID;
    await runWithRlsContext(
      { schoolId, isSuperAdmin: false, inRlsTransaction: false },
      async () => {
        const whereKey = {
          marksheet_session_scope: {
            school_id: schoolId,
            year,
            student_id: studentId,
          },
        };
        await prisma.marksheet_sessions.upsert({
          where: whereKey,
          create: {
            school_id: schoolId,
            year,
            student_id: studentId,
            status: "generating",
            attempts: 1,
          },
          update: {
            status: "generating",
            attempts: { increment: 1 },
            error: null,
          },
        });

        try {
          const hashAtStart = await this.computeSessionYearHash(year);
          const existing = await prisma.marksheet_sessions.findUnique({
            where: whereKey,
            select: { input_hash: true, r2_key: true },
          });
          if (
            existing?.input_hash === hashAtStart &&
            existing.r2_key &&
            (await headObject(existing.r2_key))
          ) {
            await prisma.marksheet_sessions.update({
              where: whereKey,
              data: { status: "ready", error: null },
            });
            logger.info("[marksheet] job(session-year): SKIP render", { year });
            return;
          }

          const buffer = await MarksService.generateAllMarksheetsPDF(
            String(year),
          );
          const key = this.r2SessionYearKey(schoolId, year);
          const hashAtEnd = await this.computeSessionYearHash(year);
          if (hashAtEnd !== hashAtStart) {
            await prisma.marksheet_sessions.update({
              where: whereKey,
              data: { status: "pending", error: null },
            });
            setImmediate(() => {
              enqueueUserPriority(job, sessionYearJobId(year)).catch(() => {});
            });
            logger.info(
              "[marksheet] job(session-year): DEFER after render (concurrent edit)",
              { year, bytes: buffer.length },
            );
            return;
          }

          await uploadToR2(key, buffer);
          await prisma.marksheet_sessions.update({
            where: whereKey,
            data: {
              status: "ready",
              r2_key: key,
              input_hash: hashAtEnd,
              generated_at: new Date(),
              error: null,
            },
          });
          logger.info("[marksheet] job(session-year): READY", {
            year,
            bytes: buffer.length,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await prisma.marksheet_sessions
            .update({
              where: whereKey,
              data: { status: "failed", error: msg.slice(0, 500) },
            })
            .catch(() => {});
          throw e;
        }
      },
    );
  }

  /**
   * Students in bundle scope with at least one non-null mark, in PDF page order
   * (section, roll, name).
   */
  private static async listBundleMembers(
    examId: number,
    cls: number,
    year: number,
    bundleSection: string,
  ): Promise<{ studentId: number; section: string }[]> {
    const enrollmentWhere = this.enrollmentWhereForBundleSection(
      cls,
      year,
      bundleSection,
    );
    const enrollments = await prisma.student_enrollments.findMany({
      where: enrollmentWhere,
      select: {
        id: true,
        student_id: true,
        section: true,
      },
      orderBy: [
        { section: "asc" },
        { roll: "asc" },
        { student: { name: "asc" } },
      ],
    });
    if (enrollments.length === 0) return [];

    const withMarks = await prisma.marks.findMany({
      where: {
        exam_id: examId,
        marks: { not: null },
        enrollment_id: { in: enrollments.map((e) => e.id) },
      },
      distinct: ["enrollment_id"],
      select: { enrollment_id: true },
    });
    const ok = new Set(withMarks.map((m) => m.enrollment_id));
    return enrollments
      .filter((e) => ok.has(e.id))
      .map((e) => ({ studentId: e.student_id, section: e.section }));
  }

  /** Queue user-priority student jobs for members that are missing or stale. */
  private static async enqueueStaleBundleMembers(
    staleStudentIds: number[],
    examId: number,
    examName: string,
    year: number,
    schoolId: number,
  ): Promise<void> {
    if (staleStudentIds.length === 0) return;

    const existing = await prisma.marksheet_files.findMany({
      where: { exam_id: examId, student_id: { in: staleStudentIds } },
      select: { student_id: true },
    });
    const have = new Set(existing.map((r) => r.student_id));
    const missing = staleStudentIds.filter((id) => !have.has(id));
    if (missing.length > 0) {
      await prisma.marksheet_files
        .createMany({
          data: missing.map((id) => ({
            student_id: id,
            exam_id: examId,
            exam_name: examName,
            year,
            school_id: schoolId,
            status: "pending",
          })),
          skipDuplicates: true,
        })
        .catch(() => {});
    }

    await prisma.marksheet_files.updateMany({
      where: {
        exam_id: examId,
        student_id: { in: staleStudentIds },
        status: { not: "generating" },
      },
      data: { status: "pending", error: null },
    });

    await Promise.all(
      staleStudentIds.map((studentId) =>
        enqueueUserPriority(
          { studentId, examId, examName, year, schoolId },
          jobId(examId, studentId),
        ).catch(() => {}),
      ),
    );
  }

  static async processBundleJob(job: BundleJob): Promise<void> {
    const { examId, examName, year, class: cls, schoolId } = job;
    const bundleSection = this.bundleSectionKey(job.bundleSection);
    const t0 = Date.now();
    await runWithRlsContext(
      { schoolId, isSuperAdmin: false, inRlsTransaction: false },
      async () => {
        const claim = await prisma.marksheet_bundles.updateMany({
          where: {
            exam_id: examId,
            class: cls,
            section: bundleSection,
            status: { in: ["pending", "failed"] },
          },
          data: { status: "generating", attempts: { increment: 1 } },
        });
        if (claim.count === 0) {
          logger.debug("[marksheet] job(bundle): not claimable, skipping", {
            examId,
            class: cls,
            section: bundleSection,
          });
          return;
        }
        logger.info("[marksheet] job(bundle): claimed", {
          examId,
          class: cls,
          section: bundleSection,
        });

        const whereKey = {
          exam_id_class_section: {
            exam_id: examId,
            class: cls,
            section: bundleSection,
          },
        };
        try {
          const examRow = await prisma.exams.findUnique({
            where: { id: examId },
            select: { result_date: true },
          });
          const snapRow = await prisma.marksheet_bundles.findUnique({
            where: whereKey,
            select: {
              input_hash: true,
              r2_key: true,
              snapshot_head_id: true,
              snapshot_head_role: true,
              snapshot_teachers: true,
              snapshot_signatory_detail: true,
            },
          });
          const frozen = isExamFrozen(examRow?.result_date);
          const snapTeachers = (snapRow?.snapshot_teachers ??
            null) as Record<string, number> | null;
          if (
            frozen &&
            snapRow &&
            (snapRow.snapshot_head_id != null ||
              (snapTeachers && Object.keys(snapTeachers).length > 0)) &&
            !this.parseSignatoryDetail(snapRow.snapshot_signatory_detail)
          ) {
            const [headLive, teachersLive] = await Promise.all([
              this.headFingerprintById(
                snapRow.snapshot_head_id,
                snapRow.snapshot_head_role,
              ),
              this.teacherFingerprintByIds(snapTeachers ?? {}),
            ]);
            const teachersDetail: Record<
              string,
              {
                name: string | null;
                signature: string | null;
                phone: string | null;
              }
            > = {};
            for (const t of teachersLive) {
              teachersDetail[t.sec] = {
                name: t.name,
                signature: await this.freezeSignatoryAsset(
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
                      signature: await this.freezeSignatoryAsset(
                        schoolId,
                        examId,
                        `head-${headLive.id}`,
                        headLive.sig,
                      ),
                    }
                  : null,
              teachers: teachersDetail,
            };
            await prisma.marksheet_bundles.update({
              where: whereKey,
              data: { snapshot_signatory_detail: detail },
            });
          }

          const hashAtStart = await this.computeBundleHash(
            examId,
            cls,
            year,
            bundleSection,
          );
          const row = await prisma.marksheet_bundles.findUnique({
            where: whereKey,
            select: {
              input_hash: true,
              r2_key: true,
            },
          });
          if (
            row?.input_hash === hashAtStart &&
            row.r2_key &&
            (await headObject(row.r2_key))
          ) {
            if (
              await this.bundleJobStale(
                examId,
                cls,
                year,
                bundleSection,
                hashAtStart,
              )
            ) {
              await prisma.marksheet_bundles.update({
                where: whereKey,
                data: { status: "pending", error: null },
              });
              this.deferBundleRequeue({ ...job, bundleSection });
              logger.info(
                "[marksheet] job(bundle): DEFER after skip (concurrent edit)",
                {
                  examId,
                  class: cls,
                  section: bundleSection,
                  ms: Date.now() - t0,
                },
              );
              return;
            }
            await prisma.marksheet_bundles.update({
              where: whereKey,
              data: { status: "ready", error: null },
            });
            logger.info(
              "[marksheet] job(bundle): SKIP merge (inputs unchanged)",
              {
                examId,
                class: cls,
                section: bundleSection,
                ms: Date.now() - t0,
              },
            );
            return;
          }

          const members = await this.listBundleMembers(
            examId,
            cls,
            year,
            bundleSection,
          );
          if (members.length === 0) {
            throw new Error(
              "No non-null marks found for any student in this class.",
            );
          }

          const memberRows = await prisma.marksheet_files.findMany({
            where: {
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
              snapshot_design_version: true,
            },
          });
          const rowByStudent = new Map(
            memberRows.map((r) => [r.student_id, r]),
          );

          const staleStudentIds: number[] = [];
          const inFlightStudentIds: number[] = [];
          for (const m of members) {
            const fileRow = rowByStudent.get(m.studentId) ?? null;
            if (
              await this.isStudentCacheFresh(
                m.studentId,
                examId,
                year,
                fileRow,
              )
            ) {
              continue;
            }

            const st = fileRow?.status;
            // Content already matches live hash + R2, but the row is still
            // pending/generating (e.g. a skip-bound job). Wait — do not treat
            // as needing regen, or we livelock: enqueue → SKIP → reclaim → …
            if (
              (st === "generating" || st === "pending") &&
              (await this.isStudentContentFresh(
                m.studentId,
                examId,
                year,
                fileRow,
              ))
            ) {
              inFlightStudentIds.push(m.studentId);
              continue;
            }

            staleStudentIds.push(m.studentId);
          }

          if (staleStudentIds.length > 0) {
            await this.enqueueStaleBundleMembers(
              staleStudentIds,
              examId,
              examName,
              year,
              schoolId,
            );
            await prisma.marksheet_bundles.update({
              where: whereKey,
              data: { status: "pending", error: null },
            });
            // Back off so student jobs can finish before we reclaim.
            this.deferBundleRequeue({ ...job, bundleSection }, 1500);
            logger.info(
              "[marksheet] job(bundle): DEFER waiting for member PDFs",
              {
                examId,
                class: cls,
                section: bundleSection,
                stale: staleStudentIds.length,
                inFlight: inFlightStudentIds.length,
                members: members.length,
                ms: Date.now() - t0,
              },
            );
            return;
          }

          if (inFlightStudentIds.length > 0) {
            // Orphan pending with good content: ensure a job exists so SKIP can
            // promote to ready. Never re-invalidate generating rows.
            await Promise.all(
              inFlightStudentIds.map(async (studentId) => {
                const row = rowByStudent.get(studentId);
                if (row?.status !== "pending") return;
                await ensureJobQueued(
                  {
                    studentId,
                    examId,
                    examName,
                    year,
                    schoolId,
                  },
                  jobId(examId, studentId),
                  PRIORITY_USER,
                ).catch(() => {});
              }),
            );
            await prisma.marksheet_bundles.update({
              where: whereKey,
              data: { status: "pending", error: null },
            });
            this.deferBundleRequeue({ ...job, bundleSection }, 1500);
            logger.info(
              "[marksheet] job(bundle): DEFER waiting for in-flight members",
              {
                examId,
                class: cls,
                section: bundleSection,
                inFlight: inFlightStudentIds.length,
                members: members.length,
                ms: Date.now() - t0,
              },
            );
            return;
          }

          // All members ready + hash-verified — safe to merge.

          logger.info(
            "[marksheet] job(bundle): parallel download member PDFs",
            {
              examId,
              class: cls,
              section: bundleSection,
              members: members.length,
            },
          );
          const tDownload = Date.now();
          const fetched = await Promise.all(
            members.map(async (m) => {
              const fileRow = rowByStudent.get(m.studentId)!;
              const buf = await getFileBuffer(fileRow.r2_key!);
              return { studentId: m.studentId, buf };
            }),
          );
          const downloadMs = Date.now() - tDownload;
          const missingIds = fetched
            .filter((f) => !f.buf)
            .map((f) => f.studentId);
          if (missingIds.length > 0) {
            await this.enqueueStaleBundleMembers(
              missingIds,
              examId,
              examName,
              year,
              schoolId,
            );
            await prisma.marksheet_bundles.update({
              where: whereKey,
              data: { status: "pending", error: null },
            });
            this.deferBundleRequeue({ ...job, bundleSection });
            logger.info(
              "[marksheet] job(bundle): DEFER missing R2 member buffer",
              {
                examId,
                class: cls,
                section: bundleSection,
                studentIds: missingIds,
                downloadMs,
                ms: Date.now() - t0,
              },
            );
            return;
          }

          const buffers = fetched.map((f) => f.buf!);
          const downloadBytes = buffers.reduce((n, b) => n + b.length, 0);
          logger.info(
            "[marksheet] job(bundle): parallel download done",
            {
              examId,
              class: cls,
              section: bundleSection,
              members: members.length,
              bytes: downloadBytes,
              downloadMs,
            },
          );

          logger.info("[marksheet] job(bundle): merging member PDFs", {
            examId,
            class: cls,
            section: bundleSection,
            members: members.length,
          });
          const tMerge = Date.now();
          const buffer = await mergeMarksheetPdfs(buffers);
          const mergeMs = Date.now() - tMerge;
          const key = this.r2BundleKey(
            schoolId,
            year,
            examId,
            cls,
            bundleSection,
          );
          await uploadToR2(key, buffer);

          const usedTeachersBySection: Record<string, number> = {};
          let usedHeadId: number | null = null;
          let usedHeadRole: string | null = null;
          let usedDesignVersion: string | null = MARKSHEET_DESIGN_VERSION;
          let bundleHeadDetail: {
            name: string | null;
            signature: string | null;
          } | null = null;
          const bundleTeachersDetail: Record<
            string,
            { name: string | null; signature: string | null; phone: string | null }
          > = {};
          for (const m of members) {
            const fileRow = rowByStudent.get(m.studentId)!;
            const memberDetail = this.parseSignatoryDetail(
              fileRow.snapshot_signatory_detail,
            );
            if (usedHeadId == null && fileRow.snapshot_head_id != null) {
              usedHeadId = fileRow.snapshot_head_id;
              usedHeadRole = fileRow.snapshot_head_role;
              bundleHeadDetail = memberDetail?.head ?? null;
            }
            if (
              fileRow.snapshot_teacher_id != null &&
              usedTeachersBySection[m.section] == null
            ) {
              usedTeachersBySection[m.section] = fileRow.snapshot_teacher_id;
              bundleTeachersDetail[m.section] = memberDetail?.teacher ?? {
                name: null,
                signature: null,
                phone: null,
              };
            }
            if (fileRow.snapshot_design_version) {
              usedDesignVersion = fileRow.snapshot_design_version;
            }
          }
          const bundleSignatoryDetail = {
            head: bundleHeadDetail,
            teachers: bundleTeachersDetail,
          };
          await prisma.marksheet_bundles.update({
            where: whereKey,
            data: {
              snapshot_head_id: usedHeadId,
              snapshot_head_role: usedHeadRole,
              snapshot_teachers: usedTeachersBySection,
              snapshot_signatory_detail: bundleSignatoryDetail,
              snapshot_design_version: usedDesignVersion,
            },
          });

          const hashAtEnd = await this.computeBundleHash(
            examId,
            cls,
            year,
            bundleSection,
          );
          const afterMerge = await prisma.marksheet_bundles.findUnique({
            where: whereKey,
            select: { status: true },
          });
          if (
            hashAtEnd !== hashAtStart ||
            afterMerge?.status !== "generating"
          ) {
            await prisma.marksheet_bundles.update({
              where: whereKey,
              data: { status: "pending", error: null },
            });
            this.deferBundleRequeue({ ...job, bundleSection });
            logger.info(
              "[marksheet] job(bundle): DEFER after merge (concurrent edit)",
              {
                examId,
                class: cls,
                section: bundleSection,
                key,
                bytes: buffer.length,
                downloadMs,
                mergeMs,
                ms: Date.now() - t0,
              },
            );
            return;
          }

          await prisma.marksheet_bundles.update({
            where: whereKey,
            data: {
              status: "ready",
              r2_key: key,
              input_hash: hashAtEnd,
              snapshot_head_id: usedHeadId,
              snapshot_head_role: usedHeadRole,
              snapshot_teachers: usedTeachersBySection,
              snapshot_signatory_detail: bundleSignatoryDetail,
              snapshot_design_version: usedDesignVersion,
              generated_at: new Date(),
              error: null,
              attempts: 0,
            },
          });
          logger.info("[marksheet] job(bundle): READY", {
            examId,
            class: cls,
            section: bundleSection,
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
            logger.info(
              "[marksheet] job(bundle): SKIPPED (nothing to merge)",
              {
                examId,
                class: cls,
                section: bundleSection,
                reason: message,
              },
            );
            return;
          }
          logger.error("[marksheet] job(bundle): FAILED", {
            examId,
            class: cls,
            section: bundleSection,
            error: message,
          });
          throw err;
        }
      },
    );
  }

  /**
   * Startup recovery: reset sheets stuck in `generating` or left `failed`,
   * promote ready bundles pinned stale (`input_hash` null) to pending, and
   * re-enqueue them. Empty-bundle failures stay terminal (`skipped`).
   * Safe to run on every boot.
   */
  static async recover(): Promise<void> {
    // Bundles recorded `failed` for a class that has nothing to render. The
    // outcome is already known, so settle them terminal rather than leaving
    // them for the poll-driven re-queue to retry.
    await prisma.marksheet_bundles.updateMany({
      where: {
        status: "failed",
        OR: EMPTY_BUNDLE_MESSAGES.map((m) => ({ error: { contains: m } })),
      },
      data: { status: "skipped", error: null, attempts: 0 },
    });

    // Mark-edit pins: ready + cleared hash. Cheap pre-warm on boot so they
    // do not wait for the next download.
    const pinnedStaleBundles = await prisma.marksheet_bundles.updateMany({
      where: { status: "ready", input_hash: null },
      data: { status: "pending", error: null },
    });

    await Promise.all([
      prisma.marksheet_files.updateMany({
        where: { status: { in: ["generating", "failed"] } },
        data: { status: "pending", error: null },
      }),
      prisma.marksheet_bundles.updateMany({
        where: { status: { in: ["generating", "failed"] } },
        data: { status: "pending", error: null },
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
          section: true,
          school_id: true,
        },
      }),
    ]);

    // ensureJobQueued clears Redis failed/completed orphans before re-add
    // (addBulk alone would collide on existing failed jobIds).
    let queuedStudents = 0;
    for (const r of pending) {
      const ok = await ensureJobQueued(
        {
          studentId: r.student_id,
          examId: r.exam_id,
          examName: r.exam_name,
          year: r.year,
          schoolId: r.school_id,
        },
        jobId(r.exam_id, r.student_id),
        PRIORITY_BACKFILL,
      );
      if (ok) queuedStudents++;
    }

    let queuedBundles = 0;
    for (const r of pendingBundles) {
      const ok = await ensureJobQueued(
        {
          kind: "bundle" as const,
          examId: r.exam_id,
          examName: r.exam_name,
          year: r.year,
          class: r.class,
          schoolId: r.school_id,
          bundleSection: r.section,
        },
        bundleJobId(r.exam_id, r.class, r.section),
        PRIORITY_BACKFILL,
      );
      if (ok) queuedBundles++;
    }

    logger.info("[marksheet] recover: re-enqueued pending/failed on startup", {
      students: pending.length,
      bundles: pendingBundles.length,
      pinnedStaleBundles: pinnedStaleBundles.count,
      queuedStudents,
      queuedBundles,
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
