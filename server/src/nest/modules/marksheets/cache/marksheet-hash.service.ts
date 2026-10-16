import crypto from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@/generated/prisma/client.js';
import { headObject, headObjectEtag } from '@/config/r2.js';
import { isExamFrozen } from '@/modules/exam/exam-year-end.js';
import { PRISMA } from '../../../common/prisma.module.js';
import {
  MARKSHEET_DESIGN_VERSION,
  enrollmentWhereForBundleSection,
  marksheetBundleWhere,
  marksheetSessionWhere,
  marksheetStudentWhere,
  parseBundleSections,
  parseSignatoryDetail,
} from './marksheet-cache.helpers.js';
import type { SignatoryDetail } from './marksheet-cache.helpers.js';

type HeadFingerprint = {
  id: number | null;
  role: string | null;
  name: string | null;
  sig: string | null;
  sigv: string | null;
};
type TeacherFingerprint = {
  sec: string;
  id: number;
  name: string | null;
  sig: string | null;
  sigv: string | null;
};
type CacheRow = { input_hash: string | null; r2_key: string | null };

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

function frozenHeadFingerprint(
  headId: number | null,
  headRole: string | null,
  detail: SignatoryDetail | null,
): HeadFingerprint {
  return {
    id: headId,
    role: headRole ?? 'Headmaster',
    name: detail?.head?.name ?? null,
    sig: detail?.head?.signature ?? null,
    // Path is exam-scoped frozen copy — no live ETag.
    sigv: null,
  };
}

function frozenTeacherFingerprint(
  section: string,
  teacherId: number | null,
  detail: SignatoryDetail | null,
): TeacherFingerprint[] {
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

/** Stable digest of student names in scope (bundle / session-year pages). */
const namesDigest = (names: string[]): string =>
  crypto.createHash('sha256').update(names.join('\0')).digest('hex');

const sha256 = (fingerprint: unknown) =>
  crypto.createHash('sha256').update(JSON.stringify(fingerprint)).digest('hex');

/** R2 ETag of a signature object — catches in-place overwrites at the same path. */
async function signatureEtag(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  return headObjectEtag(path);
}

/**
 * Input fingerprints for every cached marksheet PDF, computed with cheap indexed
 * queries (no render), plus "is the cached object still fresh" checks.
 */
@Injectable()
export class MarksheetHashService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async isSessionCacheFresh(
    schoolId: number,
    year: number,
    studentId: number,
    hash: string,
  ): Promise<{ r2_key: string } | null> {
    const row = await this.prisma.marksheet_sessions.findUnique({
      where: marksheetSessionWhere(schoolId, year, studentId),
      select: { status: true, input_hash: true, r2_key: true },
    });
    if (
      !row ||
      row.status !== 'ready' ||
      !row.r2_key ||
      !row.input_hash ||
      row.input_hash !== hash
    ) {
      return null;
    }
    if (!(await headObject(row.r2_key))) return null;
    return { r2_key: row.r2_key };
  }

  /** True when a ready row still matches live marks/stats and R2. */
  async isStudentCacheFresh(
    schoolId: number,
    studentId: number,
    examId: number,
    year: number,
    row: (CacheRow & { status: string }) | null,
  ): Promise<boolean> {
    if (!row || row.status !== 'ready') return false;
    return this.isStudentContentFresh(schoolId, studentId, examId, year, row);
  }

  /**
   * Hash + R2 match for the cached PDF bytes, ignoring row status.
   * Used by bundle merge to tell "content already good, job in flight" from
   * "content actually stale / missing".
   */
  async isStudentContentFresh(
    schoolId: number,
    studentId: number,
    examId: number,
    year: number,
    row: CacheRow | null,
  ): Promise<boolean> {
    if (!row?.r2_key || !row.input_hash) return false;
    const hash = await this.computeInputHash(schoolId, studentId, examId, year);
    if (row.input_hash !== hash) return false;
    return !!(await headObject(row.r2_key));
  }

  async isBundleCacheFresh(
    schoolId: number,
    examId: number,
    cls: number,
    year: number,
    bundleSection: string,
    row: (CacheRow & { status: string }) | null,
  ): Promise<boolean> {
    if (!row || row.status !== 'ready' || !row.r2_key || !row.input_hash) {
      return false;
    }
    const hash = await this.computeBundleHash(schoolId, examId, cls, year, bundleSection);
    if (row.input_hash !== hash) return false;
    return !!(await headObject(row.r2_key));
  }

  /**
   * Fingerprint of everything that changes the rendered PDF. Lets the worker
   * skip regeneration when an invalidation flipped a sheet whose inputs did not
   * actually change. Includes head assignment and class-teacher (levels) for
   * the student's section.
   */
  async computeInputHash(
    schoolId: number,
    studentId: number,
    examId: number,
    year: number,
  ): Promise<string> {
    const [enrollment, exam, snapRow] = await Promise.all([
      this.prisma.student_enrollments.findFirst({
        where: { school_id: schoolId, student_id: studentId, year },
        select: {
          class: true,
          section: true,
          roll: true,
          fourth_subject_id: true,
          school_id: true,
          student: { select: { name: true } },
        },
      }),
      this.prisma.exams.findUnique({
        where: { id: examId, school_id: schoolId },
        select: {
          exam_name: true,
          result_date: true,
          return_date: true,
          school_id: true,
          visible: true,
          is_year_end: true,
        },
      }),
      this.prisma.marksheet_files.findUnique({
        where: marksheetStudentWhere(schoolId, studentId, examId),
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
    const signatoryDetail = parseSignatoryDetail(snapRow?.snapshot_signatory_detail);
    const useSnapshot =
      frozen &&
      !!snapRow &&
      (snapRow.snapshot_head_id != null || snapRow.snapshot_teacher_id != null);
    const useFrozenDetail = useSnapshot && !!signatoryDetail;

    // Year-end/session sheets depend on the class pass rule and the school's promotion engine.
    const sessionRules =
      exam?.is_year_end && enrollment
        ? Promise.all([
            this.prisma.promotion_pass_rules.findUnique({
              where: {
                school_id_year_class: { school_id: schoolId, year, class: enrollment.class },
              },
              select: { max_failed: true },
            }),
            this.prisma.school.findUnique({
              where: { id: schoolId },
              select: { promotionVersion: true },
            }),
          ])
        : Promise.resolve(null);

    const [markAgg, stats, head, classTeacher, school, rules] = await Promise.all([
      this.prisma.marks.aggregate({
        // Year-end sheet = session sheet: previous exam + class-wide position, so any class mark counts.
        where:
          exam?.is_year_end && enrollment
            ? { school_id: schoolId, enrollment: { class: enrollment.class, year } }
            : { school_id: schoolId, exam_id: examId, enrollment: { student_id: studentId, year } },
        _max: { updated_at: true },
        _count: { _all: true },
      }),
      enrollment
        ? this.prisma.exam_class_stats.findFirst({
            where: { school_id: schoolId, exam_id: examId, class: enrollment.class, year },
            select: { updated_at: true },
          })
        : Promise.resolve(null),
      useFrozenDetail
        ? Promise.resolve(
            frozenHeadFingerprint(
              snapRow!.snapshot_head_id,
              snapRow!.snapshot_head_role,
              signatoryDetail,
            ),
          )
        : useSnapshot
          ? this.headFingerprintById(
              schoolId,
              snapRow!.snapshot_head_id,
              snapRow!.snapshot_head_role,
            )
          : this.headMsgFingerprint(schoolId),
      enrollment
        ? useFrozenDetail
          ? Promise.resolve(
              frozenTeacherFingerprint(
                enrollment.section,
                snapRow!.snapshot_teacher_id,
                signatoryDetail,
              ),
            )
          : useSnapshot
            ? this.teacherFingerprintByIds(
                schoolId,
                snapRow!.snapshot_teacher_id != null
                  ? { [enrollment.section]: snapRow!.snapshot_teacher_id }
                  : {},
              )
            : this.classTeacherFingerprint(schoolId, enrollment.class, year, [enrollment.section])
        : Promise.resolve([]),
      this.schoolFingerprintForExam(enrollment?.school_id ?? exam?.school_id ?? null, exam),
      sessionRules,
    ]);

    return sha256({
      pr: rules ? (rules[0]?.max_failed ?? 0) : null,
      pv: rules ? (rules[1]?.promotionVersion ?? null) : null,
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
  }

  /** Fingerprint of a class's marks + stats for bundle staleness checks. */
  async computeBundleHash(
    schoolId: number,
    examId: number,
    cls: number,
    year: number,
    bundleSection = 'ALL',
  ): Promise<string> {
    const enrollmentWhere = enrollmentWhereForBundleSection(schoolId, cls, year, bundleSection);
    const bundleSections = parseBundleSections(bundleSection);

    const [exam, snapRow] = await Promise.all([
      this.prisma.exams.findUnique({
        where: { id: examId, school_id: schoolId },
        select: {
          exam_name: true,
          result_date: true,
          return_date: true,
          school_id: true,
          visible: true,
          is_year_end: true,
        },
      }),
      this.prisma.marksheet_bundles.findUnique({
        where: marksheetBundleWhere(schoolId, examId, cls, bundleSection),
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
    const signatoryDetail = parseSignatoryDetail(snapRow?.snapshot_signatory_detail);
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
              frozenTeacherFingerprint(sec, id, { teachers: signatoryDetail?.teachers }),
            )
        : null;

    const [markAgg, stats, head, classTeachers, school, memberNames] = await Promise.all([
      this.prisma.marks.aggregate({
        where: exam?.is_year_end
          ? { school_id: schoolId, enrollment: { class: cls, year } }
          : { school_id: schoolId, exam_id: examId, enrollment: enrollmentWhere },
        _max: { updated_at: true },
        _count: { _all: true },
      }),
      this.prisma.exam_class_stats.findFirst({
        where: { school_id: schoolId, exam_id: examId, class: cls, year },
        select: { updated_at: true },
      }),
      useFrozenDetail
        ? Promise.resolve(
            frozenHeadFingerprint(
              snapRow!.snapshot_head_id,
              snapRow!.snapshot_head_role,
              signatoryDetail,
            ),
          )
        : useSnapshot
          ? this.headFingerprintById(
              schoolId,
              snapRow!.snapshot_head_id,
              snapRow!.snapshot_head_role,
            )
          : this.headMsgFingerprint(schoolId),
      frozenTeachersFp
        ? Promise.resolve(frozenTeachersFp)
        : useSnapshot
          ? this.teacherFingerprintByIds(schoolId, snapTeachers ?? {})
          : this.classTeacherFingerprint(schoolId, cls, year, bundleSections),
      this.schoolFingerprintForExam(snapRow?.school_id ?? exam?.school_id ?? null, exam),
      this.prisma.student_enrollments.findMany({
        where: enrollmentWhere,
        select: { student: { select: { name: true } } },
        orderBy: [{ section: 'asc' }, { roll: 'asc' }, { student: { name: 'asc' } }],
      }),
    ]);
    return sha256({
      sec: bundleSection,
      n: markAgg._count?._all ?? 0,
      m: isoStamp(markAgg._max?.updated_at),
      s: isoStamp(stats?.updated_at),
      h: head,
      t: classTeachers,
      sn: namesDigest(memberNames.map((e) => e.student?.name ?? '')),
      sch: school,
      en: exam?.exam_name ?? null,
      rd: exam?.result_date ?? null,
      retd: exam?.return_date ?? null,
      ...designFingerprint(frozen, snapRow?.snapshot_design_version),
    });
  }

  async computeSessionStudentHash(
    schoolId: number,
    studentId: number,
    year: number,
  ): Promise<string> {
    const enrollment = await this.prisma.student_enrollments.findFirst({
      where: { school_id: schoolId, student_id: studentId, year },
      select: {
        roll: true,
        fourth_subject_id: true,
        class: true,
        section: true,
        student: { select: { name: true } },
      },
    });
    const [markAgg, head, classTeacher, school] = await Promise.all([
      this.prisma.marks.aggregate({
        // Position ranks the whole class, so any class mark change refreshes the sheet.
        where: {
          school_id: schoolId,
          enrollment: enrollment
            ? { class: enrollment.class, year }
            : { student_id: studentId, year },
        },
        _max: { updated_at: true },
        _count: { _all: true },
      }),
      this.headMsgFingerprint(schoolId),
      enrollment
        ? this.classTeacherFingerprint(schoolId, enrollment.class, year, [enrollment.section])
        : Promise.resolve([]),
      this.schoolMarksheetFingerprint(schoolId),
    ]);
    return sha256({
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
  }

  async computeSessionYearHash(schoolId: number, year: number): Promise<string> {
    const [markAgg, head, classTeachers, school, enrollments] = await Promise.all([
      this.prisma.marks.aggregate({
        where: { school_id: schoolId, enrollment: { year } },
        _max: { updated_at: true },
        _count: { _all: true },
      }),
      this.headMsgFingerprint(schoolId),
      this.yearClassTeacherFingerprint(schoolId, year),
      this.schoolMarksheetFingerprint(schoolId),
      this.prisma.student_enrollments.findMany({
        where: { school_id: schoolId, year },
        select: { student: { select: { name: true } } },
        orderBy: [{ class: 'asc' }, { section: 'asc' }, { roll: 'asc' }],
      }),
    ]);
    return sha256({
      n: markAgg._count?._all ?? 0,
      m: isoStamp(markAgg._max?.updated_at),
      h: head,
      t: classTeachers,
      sn: namesDigest(enrollments.map((e) => e.student?.name ?? '')),
      sch: school,
      d: MARKSHEET_DESIGN_VERSION,
    });
  }

  /**
   * Head fingerprint resolved by a snapshotted teacher id (the "who"), reading
   * that person's CURRENT name/signature. Used for frozen exams so a later head
   * reassignment is ignored while the same person's later signature upload is not.
   */
  async headFingerprintById(
    schoolId: number,
    headId: number | null,
    headRole: string | null,
  ): Promise<HeadFingerprint> {
    if (headId == null) {
      return { id: null, role: headRole ?? null, name: null, sig: null, sigv: null };
    }
    const t = await this.prisma.teachers.findUnique({
      where: { id: headId, school_id: schoolId },
      select: { name: true, signature: true },
    });
    const sig = t?.signature ?? null;
    return {
      id: headId,
      role: headRole ?? 'Headmaster',
      name: t?.name ?? null,
      sig,
      sigv: await signatureEtag(sig),
    };
  }

  /** Class-teacher fingerprint(s) resolved by snapshotted teacher id(s). */
  async teacherFingerprintByIds(
    schoolId: number,
    sectionToTeacherId: Record<string, number>,
  ): Promise<TeacherFingerprint[]> {
    const entries = Object.entries(sectionToTeacherId).sort(([a], [b]) => a.localeCompare(b));
    return Promise.all(
      entries.map(async ([sec, id]) => {
        const t = await this.prisma.teachers.findUnique({
          where: { id, school_id: schoolId },
          select: { name: true, signature: true },
        });
        const sig = t?.signature ?? null;
        return { sec, id, name: t?.name ?? null, sig, sigv: await signatureEtag(sig) };
      }),
    );
  }

  private async headMsgFingerprint(
    schoolId: number,
  ): Promise<{ u: string | null } & HeadFingerprint> {
    const head = await this.prisma.head_msg.findFirst({
      where: { school_id: schoolId },
      orderBy: [{ updated_at: 'desc' }, { id: 'desc' }],
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
      sigv: await signatureEtag(sig),
    };
  }

  /** Class-teacher assignments that appear on marksheets (per class/section/year). */
  private async classTeacherFingerprint(
    schoolId: number,
    cls: number,
    year: number,
    sections?: string[],
  ): Promise<TeacherFingerprint[]> {
    const rows = await this.prisma.levels.findMany({
      where: {
        school_id: schoolId,
        class_name: cls,
        year,
        ...(sections && sections.length > 0 ? { section: { in: sections } } : {}),
      },
      select: {
        section: true,
        teacher_id: true,
        teacher: { select: { name: true, signature: true } },
      },
      orderBy: [{ section: 'asc' }, { teacher_id: 'asc' }],
    });
    return Promise.all(
      rows.map(async (r) => {
        const sig = r.teacher?.signature ?? null;
        return {
          sec: r.section,
          id: r.teacher_id,
          name: r.teacher?.name ?? null,
          sig,
          sigv: await signatureEtag(sig),
        };
      }),
    );
  }

  private async yearClassTeacherFingerprint(
    schoolId: number,
    year: number,
  ): Promise<Array<{ cls: number } & TeacherFingerprint>> {
    const rows = await this.prisma.levels.findMany({
      where: { school_id: schoolId, year },
      select: {
        class_name: true,
        section: true,
        teacher_id: true,
        teacher: { select: { name: true, signature: true } },
      },
      orderBy: [{ class_name: 'asc' }, { section: 'asc' }, { teacher_id: 'asc' }],
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
          sigv: await signatureEtag(sig),
        };
      }),
    );
  }

  /** Website/phone/name/logo printed on marksheet headers (unpublished exams only). */
  private async schoolMarksheetFingerprint(schoolId: number | null | undefined): Promise<{
    n: string | null;
    loc: string | null;
    eiin: string | null;
    w: string | null;
    p: string | null;
    logo: string | null;
    logov: string | null;
    own: string | null;
  }> {
    const empty = {
      own: null,
      n: null,
      loc: null,
      eiin: null,
      w: null,
      p: null,
      logo: null,
      logov: null,
    };
    if (!schoolId) return empty;
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        name: true,
        upazila: true,
        district: true,
        ownership: true,
        eiin: true,
        customDomain: true,
        phone: true,
        logo: true,
      },
    });
    if (!school) return empty;
    const place = [school.upazila, school.district]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join(', ');
    const raw = school.customDomain?.trim() || '';
    let w: string | null = null;
    if (raw) {
      try {
        w = /^https?:\/\//i.test(raw)
          ? new URL(raw).hostname || null
          : raw.replace(/\/+$/, '').replace(/:\d+$/, '').toLowerCase();
      } catch {
        w =
          raw
            .replace(/^https?:\/\//i, '')
            .split('/')[0]
            ?.replace(/:\d+$/, '')
            .toLowerCase() || null;
      }
    }
    const logo = school.logo || null;
    return {
      n: school.name?.trim() || null,
      own: school.ownership ?? null,
      loc: place || null,
      eiin: school.eiin?.trim() || null,
      w,
      p: school.phone?.trim() || null,
      logo,
      logov: logo ? await signatureEtag(logo) : null,
    };
  }

  /**
   * Live school header branding in the hash only while the exam is unpublished.
   * After publish (or result_date freeze), branding is pinned — name/logo/website
   * edits must not churn finalized sheets (same idea as design / signatories).
   */
  private async schoolFingerprintForExam(
    schoolId: number | null | undefined,
    exam: { visible?: boolean | null; result_date?: string | null } | null,
  ) {
    if (exam?.visible || isExamFrozen(exam?.result_date)) return null;
    return this.schoolMarksheetFingerprint(schoolId);
  }
}
