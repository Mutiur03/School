import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@/generated/prisma/client.js';
import { rlsTransaction } from '@/config/prisma.js';
import { PRISMA } from '../../common/prisma.module.js';
import { PASS_RULE_CLASSES } from './dto/pass-rules.dto.js';
import type { PassRuleDto } from './dto/pass-rules.dto.js';
import { loadSessionResults } from './session-results.js';
import type { SessionResultRow } from './session-results.js';

const PROMOTION_CLASSES = [6, 7, 8, 9];
/** Class that takes outside admissions: its failed students get their roll via `assignRetained`, after the import. */
const DEFERRED_CLASS = 6;
const TX_OPTIONS = { timeout: 120_000 };

type Tx = Prisma.TransactionClient;

/** Same bucket as the engine's rank: class, plus group for class 10 only. */
const bucketOf = (r: SessionResultRow) =>
  `${r.classLevel}|${r.classLevel === 10 ? (r.group ?? '') : ''}`;

const subjectKey = (s: { name: string; class: number; group: string | null }) =>
  `${s.name}|${s.class}|${s.group ?? ''}`;

/** Next free roll per class+section; seeded with the highest roll other students already hold. */
const rollCounter = (taken: { class: number; section: string; roll: number }[]) => {
  const next = new Map<string, number>();
  for (const e of taken) {
    const key = `${e.class}|${e.section}`;
    next.set(key, Math.max(next.get(key) ?? 1, e.roll + 1));
  }
  return (cls: number, section: string) => {
    const key = `${cls}|${section}`;
    const roll = next.get(key) ?? 1;
    next.set(key, roll + 1);
    return roll;
  };
};

@Injectable()
export class PromotionService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  getResults(schoolId: number, year: number, classLevel?: number) {
    return loadSessionResults(this.prisma, schoolId, year, { classLevel });
  }

  /** Session results for the given classes (all when omitted); 400 when an exam the engine needs is missing. */
  private async completeResults(schoolId: number, year: number, classes?: number[]) {
    const { results, missingYearEnd, missingPrevious } = await loadSessionResults(
      this.prisma,
      schoolId,
      year,
    );
    const inScope = (c: number) => !classes || classes.includes(c);
    const noYearEnd = missingYearEnd.filter(inScope);
    if (noYearEnd.length) {
      throw new BadRequestException(
        `No year-end exam for class ${noYearEnd.join(', ')} in ${year}. Create and mark a year-end exam first.`,
      );
    }
    const noPrevious = missingPrevious.filter(inScope);
    if (noPrevious.length) {
      throw new BadRequestException(
        `No exam before the year-end exam for class ${noPrevious.join(', ')} in ${year}. Create it first.`,
      );
    }
    return results.filter((r) => inScope(r.classLevel));
  }

  /** Classes missing an exam are left untouched and reported back; the rest are written. */
  async createResults(schoolId: number, year: number) {
    const sr = await loadSessionResults(this.prisma, schoolId, year);
    const { missingYearEnd, missingPrevious } = sr;
    const results = sr.results.filter((r) => !missingPrevious.includes(r.classLevel));
    await rlsTransaction(async (tx) => {
      for (const r of results) {
        await tx.student_enrollments.update({
          where: { id: r.enrollmentId, school_id: schoolId },
          data: {
            status: r.isFailed ? 'Failed' : 'Passed',
            fail_count: r.failCount,
            final_merit: r.position,
          },
        });
      }
    }, TX_OPTIONS);
    const failed = results.filter((r) => r.isFailed).length;
    return {
      updated: results.length,
      passed: results.length - failed,
      failed,
      missingYearEnd,
      missingPrevious,
    };
  }

  async getPassRules(schoolId: number, year: number) {
    const rows = await this.prisma.promotion_pass_rules.findMany({
      where: { school_id: schoolId, year },
      select: { class: true, max_failed: true },
    });
    const byClass = new Map(rows.map((r) => [r.class, r.max_failed]));
    return PASS_RULE_CLASSES.map((cls) => ({ class: cls, max_failed: byClass.get(cls) ?? 0 }));
  }

  async savePassRules(schoolId: number, year: number, rules: PassRuleDto[]) {
    const byClass = new Map(rules.map((r) => [r.class, r.max_failed]));
    await rlsTransaction(async (tx) => {
      for (const cls of PASS_RULE_CLASSES) {
        const max_failed = byClass.get(cls) ?? 0;
        await tx.promotion_pass_rules.upsert({
          where: { school_id_year_class: { school_id: schoolId, year, class: cls } },
          create: { school_id: schoolId, year, class: cls, max_failed },
          update: { max_failed },
        });
      }
    });
    return this.getPassRules(schoolId, year);
  }

  /**
   * Re-rank with the saved status (manual overrides win): passed first, then the engine position.
   * Only rows whose saved status is Passed/Failed are kept; the rest are counted as `skipped`.
   */
  private async rank(schoolId: number, results: SessionResultRow[]) {
    const enrollments = await this.prisma.student_enrollments.findMany({
      where: { school_id: schoolId, id: { in: results.map((r) => r.enrollmentId) } },
      select: { id: true, status: true, fourth_subject_id: true },
    });
    const byId = new Map(enrollments.map((e) => [e.id, e]));
    const rows = results
      .map((result) => {
        const e = byId.get(result.enrollmentId);
        return {
          result,
          status: e?.status ?? '',
          fourthSubjectId: e?.fourth_subject_id ?? null,
          finalMerit: 0,
        };
      })
      .filter((row) => row.status === 'Passed' || row.status === 'Failed')
      .sort(
        (a, b) =>
          a.result.classLevel - b.result.classLevel ||
          bucketOf(a.result).localeCompare(bucketOf(b.result)) ||
          Number(b.status === 'Passed') - Number(a.status === 'Passed') ||
          a.result.position - b.result.position,
      );
    let bucket = '';
    let merit = 0;
    for (const row of rows) {
      if (bucketOf(row.result) !== bucket) [bucket, merit] = [bucketOf(row.result), 0];
      row.finalMerit = ++merit;
    }
    return { rows, skipped: results.length - rows.length };
  }

  /** Re-running deletes these students' next-year rows; refuse when marks would cascade with them. */
  private async assertNoNextYearMarks(tx: Tx, schoolId: number, newYear: number, ids: number[]) {
    const withMarks = await tx.student_enrollments.count({
      where: { school_id: schoolId, year: newYear, student_id: { in: ids }, marks: { some: {} } },
    });
    if (withMarks) {
      throw new BadRequestException(
        `${withMarks} enrollment(s) in ${newYear} already have marks; re-running would delete them.`,
      );
    }
  }

  /** Next-year enrollments held by students outside the plan; their rolls stay reserved. */
  private otherNextYear(schoolId: number, newYear: number, studentIds: number[], cls?: number) {
    return this.prisma.student_enrollments.findMany({
      where: {
        school_id: schoolId,
        year: newYear,
        student_id: { notIn: studentIds },
        ...(cls != null && { class: cls }),
      },
      select: { class: true, section: true, roll: true },
    });
  }

  private async promotionPlan(schoolId: number, year: number) {
    const newYear = year + 1;
    const { rows: ranked, skipped } = await this.rank(
      schoolId,
      await this.completeResults(schoolId, year, PROMOTION_CLASSES),
    );
    const studentIds = ranked.map((r) => r.result.studentId);
    const [taken, existingNextYear, subjectsNextYear, newClass6] = await Promise.all([
      this.otherNextYear(schoolId, newYear, studentIds),
      this.prisma.student_enrollments.count({
        where: { school_id: schoolId, year: newYear, student_id: { in: studentIds } },
      }),
      this.prisma.subjects.count({ where: { school_id: schoolId, year: newYear } }),
      // Newly admitted = next-year class 6 with no enrollment this year (Pending/skipped students have one).
      this.prisma.student_enrollments.count({
        where: {
          school_id: schoolId,
          year: newYear,
          class: DEFERRED_CLASS,
          student_id: { notIn: studentIds },
          student: { enrollments: { none: { school_id: schoolId, year } } },
        },
      }),
    ]);

    // Odd merit → section A, even → B; rolls count up per next-year class+section in merit order
    // (rows are already ordered class → group → merit, so promoted students precede the retained).
    // With no class-6 admissions in `newYear` yet, failed class-6 students keep a null roll (on hold):
    // `assignRetained` numbers them after the admissions are imported.
    const class6Admissions = newClass6 > 0;
    const nextRoll = rollCounter(taken);
    const students = ranked.map(({ result: r, status, fourthSubjectId, finalMerit }) => {
      const new_class = status === 'Passed' ? r.classLevel + 1 : r.classLevel;
      const new_section = finalMerit % 2 === 1 ? 'A' : 'B';
      const deferred = status === 'Failed' && r.classLevel === DEFERRED_CLASS && !class6Admissions;
      return {
        enrollment_id: r.enrollmentId,
        student_id: r.studentId,
        name: r.studentName,
        class: r.classLevel,
        section: r.section,
        roll: r.roll,
        group: r.group,
        status,
        gpa: r.gpa,
        final_merit: finalMerit,
        new_class,
        new_section,
        new_roll: deferred ? null : nextRoll(new_class, new_section),
        fourth_subject_id: fourthSubjectId,
      };
    });
    return {
      year,
      newYear,
      students,
      skipped,
      existingNextYear,
      subjectsNextYear,
      class6Admissions,
    };
  }

  async previewPromotion(schoolId: number, year: number) {
    const { newYear, students, skipped, existingNextYear, subjectsNextYear, class6Admissions } =
      await this.promotionPlan(schoolId, year);
    return {
      year,
      newYear,
      students: students.map(({ fourth_subject_id: _, ...row }) => row),
      summary: {
        total: students.length,
        passed_promoted: students.filter((s) => s.status === 'Passed').length,
        failed_retained: students.filter((s) => s.status === 'Failed').length,
        awaiting_roll: students.filter((s) => s.new_roll == null).length,
        class6_admissions: class6Admissions,
        skipped,
        section_a: students.filter((s) => s.new_section === 'A').length,
        section_b: students.filter((s) => s.new_section === 'B').length,
        existing_next_year_enrollments: existingNextYear,
        subjects_will_clone: subjectsNextYear === 0,
      },
    };
  }

  /**
   * (old subject id, target class) → `newYear` subject id with the same name and group.
   * Clones `year`'s subjects first when `newYear` has none.
   */
  private async subjectMapping(tx: Tx, schoolId: number, year: number, newYear: number) {
    const current = await tx.subjects.findMany({ where: { school_id: schoolId, year } });
    const nextSubjects = () =>
      tx.subjects.findMany({
        where: { school_id: schoolId, year: newYear },
        select: { id: true, name: true, class: true, group: true },
      });
    let next = await nextSubjects();

    if (!next.length && current.length) {
      const clone = ({ id: _id, created_at: _c, ...s }: (typeof current)[number]) => ({
        ...s,
        school_id: schoolId,
        year: newYear,
      });
      // Units first, then papers pointing at their cloned parent.
      await tx.subjects.createMany({
        data: current.filter((s) => s.subject_type !== 'paper').map(clone),
      });
      const units = new Map((await nextSubjects()).map((s) => [subjectKey(s), s.id]));
      const oldById = new Map(current.map((s) => [s.id, s]));
      await tx.subjects.createMany({
        data: current
          .filter((s) => s.subject_type === 'paper')
          .map((s) => {
            const parent = s.parent_id != null ? oldById.get(s.parent_id) : undefined;
            return {
              ...clone(s),
              parent_id: parent ? (units.get(subjectKey(parent)) ?? null) : null,
            };
          }),
      });
      next = await nextSubjects();
    }

    const newByKey = new Map(next.map((s) => [subjectKey(s), s.id]));
    const oldById = new Map(current.map((s) => [s.id, s]));
    return (oldId: number | null, newClass: number) => {
      const old = oldId != null ? oldById.get(oldId) : undefined;
      return old ? (newByKey.get(subjectKey({ ...old, class: newClass })) ?? null) : null;
    };
  }

  async promote(schoolId: number, year: number) {
    const { newYear, students, skipped } = await this.promotionPlan(schoolId, year);
    if (!students.length) return { promoted: 0, awaitingRoll: 0, skipped, newYear };
    const placed = students.filter((s) => s.new_roll != null);

    await rlsTransaction(async (tx) => {
      const ids = students.map((s) => s.student_id);
      await this.assertNoNextYearMarks(tx, schoolId, newYear, ids);
      const mapSubject = await this.subjectMapping(tx, schoolId, year, newYear);
      // Only replace these students' next-year rows; class-10 retainees and admissions stay.
      await tx.student_enrollments.deleteMany({
        where: { school_id: schoolId, year: newYear, student_id: { in: ids } },
      });
      for (const s of students) {
        await tx.student_enrollments.update({
          where: { id: s.enrollment_id, school_id: schoolId },
          data: {
            final_merit: s.final_merit,
            next_year_section: s.new_section,
            next_year_roll: s.new_roll ?? 0, // 0 + a section = waiting for `assignRetained`
          },
        });
      }
      await tx.student_enrollments.createMany({
        data: placed.map((s) => ({
          school_id: schoolId,
          student_id: s.student_id,
          class: s.new_class,
          section: s.new_section,
          roll: s.new_roll!,
          year: newYear,
          group: s.group,
          status: 'Pending',
          fourth_subject_id: mapSubject(s.fourth_subject_id, s.new_class),
        })),
      });
    }, TX_OPTIONS);

    return {
      promoted: placed.length,
      awaitingRoll: students.length - placed.length,
      skipped,
      newYear,
    };
  }

  /** Enrollments of `year` still waiting for a next-year roll (section set, roll 0). */
  private awaitingRollWhere(schoolId: number, year: number) {
    return {
      school_id: schoolId,
      year,
      class: DEFERRED_CLASS,
      status: 'Failed',
      next_year_roll: 0,
      next_year_section: { not: null },
      student: { available: true },
    };
  }

  /**
   * Gives the failed class-6 students their next-year class-6 enrollment, in merit order, with rolls
   * after everyone already enrolled there (e.g. admissions imported since the promotion).
   */
  async assignRetained(schoolId: number, year: number) {
    const newYear = year + 1;
    const waiting = await this.prisma.student_enrollments.findMany({
      where: this.awaitingRollWhere(schoolId, year),
      select: {
        id: true,
        student_id: true,
        group: true,
        next_year_section: true,
        fourth_subject_id: true,
      },
      orderBy: { final_merit: 'asc' },
    });
    if (!waiting.length) return { assigned: 0, newYear };

    await rlsTransaction(async (tx) => {
      const taken = await tx.student_enrollments.findMany({
        where: { school_id: schoolId, year: newYear, class: DEFERRED_CLASS },
        select: { class: true, section: true, roll: true },
      });
      const nextRoll = rollCounter(taken);
      const mapSubject = await this.subjectMapping(tx, schoolId, year, newYear);
      for (const e of waiting) {
        const section = e.next_year_section!;
        const roll = nextRoll(DEFERRED_CLASS, section);
        await tx.student_enrollments.create({
          data: {
            school_id: schoolId,
            student_id: e.student_id,
            class: DEFERRED_CLASS,
            section,
            roll,
            year: newYear,
            group: e.group,
            status: 'Pending',
            fourth_subject_id: mapSubject(e.fourth_subject_id, DEFERRED_CLASS),
          },
        });
        await tx.student_enrollments.update({
          where: { id: e.id, school_id: schoolId },
          data: { next_year_roll: roll },
        });
      }
    }, TX_OPTIONS);

    return { assigned: waiting.length, newYear };
  }

  private async graduationPlan(schoolId: number, year: number) {
    const newYear = year + 1;
    const sscBatch = String(year + 1);
    const { rows: ranked, skipped } = await this.rank(
      schoolId,
      await this.completeResults(schoolId, year, [10]),
    );
    const studentIds = ranked.map((r) => r.result.studentId);
    const [taken, existingClass10NextYear] = await Promise.all([
      this.otherNextYear(schoolId, newYear, studentIds, 10),
      this.prisma.student_enrollments.count({
        where: { school_id: schoolId, year: newYear, class: 10 },
      }),
    ]);

    const nextRoll = rollCounter(taken);
    const students = ranked.map(({ result: r, status, fourthSubjectId, finalMerit }) => {
      const graduate = status === 'Passed';
      const new_section = graduate ? null : finalMerit % 2 === 1 ? 'A' : 'B';
      return {
        enrollment_id: r.enrollmentId,
        student_id: r.studentId,
        name: r.studentName,
        section: r.section,
        roll: r.roll,
        group: r.group,
        status,
        gpa: r.gpa,
        final_merit: finalMerit,
        action: graduate ? ('graduate' as const) : ('retain' as const),
        ssc_batch: graduate ? sscBatch : null,
        new_section,
        new_roll: new_section ? nextRoll(10, new_section) : null,
        fourth_subject_id: fourthSubjectId,
      };
    });
    return { year, newYear, sscBatch, students, skipped, existingClass10NextYear };
  }

  async previewGraduation(schoolId: number, year: number) {
    const plan = await this.graduationPlan(schoolId, year);
    const graduates = plan.students.filter((s) => s.action === 'graduate').length;
    return {
      year,
      newYear: plan.newYear,
      sscBatch: plan.sscBatch,
      students: plan.students,
      summary: {
        total: plan.students.length,
        graduates,
        retained: plan.students.length - graduates,
        skipped: plan.skipped,
        existing_class10_next_year: plan.existingClass10NextYear,
      },
    };
  }

  async graduate(schoolId: number, year: number) {
    const { newYear, sscBatch, students, skipped } = await this.graduationPlan(schoolId, year);
    const retained = students.filter((s) => s.action === 'retain');
    const graduates = students.filter((s) => s.action === 'graduate');
    if (!students.length) return { graduated: 0, retained: 0, skipped, newYear, sscBatch };

    await rlsTransaction(async (tx) => {
      for (const s of students) {
        await tx.student_enrollments.update({
          where: { id: s.enrollment_id, school_id: schoolId },
          data: {
            final_merit: s.final_merit,
            ...(s.action === 'graduate'
              ? { status: 'Graduated', next_year_section: null, next_year_roll: 0 }
              : { next_year_section: s.new_section, next_year_roll: s.new_roll! }),
          },
        });
      }
      if (graduates.length) {
        await tx.students.updateMany({
          where: { school_id: schoolId, id: { in: graduates.map((s) => s.student_id) } },
          data: { batch: sscBatch, available: false },
        });
      }
      if (retained.length) {
        const ids = retained.map((s) => s.student_id);
        await this.assertNoNextYearMarks(tx, schoolId, newYear, ids);
        const mapSubject = await this.subjectMapping(tx, schoolId, year, newYear);
        await tx.student_enrollments.deleteMany({
          where: { school_id: schoolId, year: newYear, student_id: { in: ids } },
        });
        await tx.student_enrollments.createMany({
          data: retained.map((s) => ({
            school_id: schoolId,
            student_id: s.student_id,
            class: 10,
            section: s.new_section!,
            roll: s.new_roll!,
            year: newYear,
            group: s.group,
            status: 'Pending',
            fourth_subject_id: mapSubject(s.fourth_subject_id, 10),
          })),
        });
      }
    }, TX_OPTIONS);

    return {
      graduated: graduates.length,
      retained: retained.length,
      skipped,
      newYear,
      sscBatch,
    };
  }

  /** Manual pass/fail override. school + year in the where: wrong tenant/year → P2025 → 404. */
  async updateResult(schoolId: number, year: number, enrollmentId: number, status: string) {
    await this.prisma.student_enrollments.update({
      where: { id: enrollmentId, school_id: schoolId, year },
      data: { status },
    });
  }

  async getStats(schoolId: number, year: number) {
    const newYear = year + 1;
    const base = { school_id: schoolId, year, student: { available: true } };
    const promotionWhere = { ...base, class: { in: PROMOTION_CLASSES } };
    const class10Where = { ...base, class: 10 };

    const [promotionByStatus, class10ByStatus, promotedCount, nextYearCount, awaitingRoll] =
      await Promise.all([
        this.prisma.student_enrollments.groupBy({
          by: ['status'],
          where: promotionWhere,
          _count: { _all: true },
        }),
        this.prisma.student_enrollments.groupBy({
          by: ['status'],
          where: class10Where,
          _count: { _all: true },
        }),
        this.prisma.student_enrollments.count({
          where: { ...promotionWhere, next_year_section: { not: null } },
        }),
        this.prisma.student_enrollments.count({ where: { school_id: schoolId, year: newYear } }),
        this.prisma.student_enrollments.count({ where: this.awaitingRollWhere(schoolId, year) }),
      ]);

    const tally = (rows: { status: string; _count: { _all: number } }[]) => {
      const counts = { passed: 0, failed: 0, pending: 0, graduated: 0, total: 0 };
      for (const { status, _count } of rows) {
        counts.total += _count._all;
        const key = status.toLowerCase() as keyof typeof counts;
        if (key in counts && key !== 'total') counts[key] += _count._all;
      }
      return counts;
    };

    return {
      year,
      newYear,
      promotion: tally(promotionByStatus),
      class10: tally(class10ByStatus),
      promoted: promotedCount > 0,
      next_year_enrollments: nextYearCount,
      awaiting_roll: awaitingRoll,
    };
  }
}
