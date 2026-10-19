import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@/generated/prisma/client.js';
import { rlsTransaction } from '@/config/prisma.js';
import { PRISMA } from '../../common/prisma.module.js';
import type { AuthUser } from '../../common/current-user.decorator.js';
import { PASS_RULE_CLASSES } from './dto/pass-rules.dto.js';
import type { PassRuleDto } from './dto/pass-rules.dto.js';
import type { CorrectionsDto as CorrectionsInput } from './dto/corrections.dto.js';
import { loadSessionResults } from './session-results.js';
import type { SessionResultRow } from './session-results.js';

const PROMOTION_CLASSES = [6, 7, 8, 9];
/** Class that takes outside admissions: its failed students get their roll via `assignRetained`, after the import. */
const DEFERRED_CLASS = 6;
const TX_OPTIONS = { timeout: 120_000 };
/** Inactive (TC'd) students are never part of results or promotion. */
const ACTIVE = { student: { available: true } };

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

/** Who ran a promotion/graduation, for the page banner. Auth('admin') guarantees an admin row. */
export const ranBy = (user: AuthUser) => ('username' in user ? user.username : null);

type Placement = Awaited<ReturnType<PromotionService['placementPlan']>>;

/** What the client sees of a placement (no internal ids). */
const publicPlacement = (p: Placement) => ({
  enrollment_id: p.enrollmentId,
  name: p.name,
  class: p.class,
  action: p.action,
  new_class: 'newClass' in p ? p.newClass : null,
  new_section: 'newSection' in p ? p.newSection : null,
  new_roll: 'newRoll' in p ? p.newRoll : null,
});

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

  /**
   * Classes missing an exam are left untouched and reported back; the rest are written.
   * Held students are never written; `only` limits the write to those enrollments (used by release).
   * Manual overrides keep their saved status.
   */
  async createResults(schoolId: number, year: number, only?: number[]) {
    const sr = await loadSessionResults(this.prisma, schoolId, year);
    const { missingYearEnd, missingPrevious } = sr;
    const results = sr.results.filter(
      (r) =>
        !missingPrevious.includes(r.classLevel) &&
        !r.held &&
        (!only || only.includes(r.enrollmentId)),
    );
    await rlsTransaction(async (tx) => {
      for (const r of results) {
        await tx.student_enrollments.update({
          where: { id: r.enrollmentId, school_id: schoolId },
          data: {
            ...(!r.manual && { status: r.isFailed ? 'Failed' : 'Passed' }),
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
   * Re-rank with the saved status (manual overrides win): auto-promoted first, then passed, then the
   * release batch and engine position. Only rows whose saved status is Passed/Failed are kept; the
   * rest are `skipped` (held, or no result generated / status set yet).
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
        const status = e?.status ?? '';
        return {
          result,
          status,
          // Engine pass in the on-time batch: the only students a regen may reshuffle.
          auto: status === 'Passed' && !result.manual && !result.releaseBatch,
          fourthSubjectId: e?.fourth_subject_id ?? null,
          finalMerit: 0,
        };
      })
      .filter((row) => row.status === 'Passed' || row.status === 'Failed')
      .sort(
        (a, b) =>
          a.result.classLevel - b.result.classLevel ||
          bucketOf(a.result).localeCompare(bucketOf(b.result)) ||
          Number(b.auto) - Number(a.auto) ||
          Number(b.status === 'Passed') - Number(a.status === 'Passed') ||
          (a.result.releaseBatch ?? 0) - (b.result.releaseBatch ?? 0) ||
          a.result.position - b.result.position,
      );
    let bucket = '';
    let merit = 0;
    for (const row of rows) {
      if (bucketOf(row.result) !== bucket) [bucket, merit] = [bucketOf(row.result), 0];
      row.finalMerit = ++merit;
    }
    const kept = new Set(rows.map((r) => r.result.enrollmentId));
    const skippedStudents = results
      .filter((r) => !kept.has(r.enrollmentId))
      .map((r) => ({
        enrollment_id: r.enrollmentId,
        name: r.studentName,
        class: r.classLevel,
        section: r.section,
        roll: r.roll,
        reason: r.held ? ('held' as const) : ('no_result' as const),
      }));
    return { rows, skipped: skippedStudents.length, skippedStudents };
  }

  /** These next-year rows are about to be deleted; refuse when marks would cascade with them. */
  private async assertNoNextYearMarks(tx: Tx, schoolId: number, newYear: number, ids: number[]) {
    if (!ids.length) return;
    const withMarks = await tx.student_enrollments.count({
      where: { school_id: schoolId, year: newYear, id: { in: ids }, marks: { some: {} } },
    });
    if (withMarks) {
      throw new BadRequestException(
        `${withMarks} enrollment(s) in ${newYear} already have marks; re-running would delete them.`,
      );
    }
  }

  private async nextYearRows(schoolId: number, newYear: number, cls?: number) {
    const rows = await this.prisma.student_enrollments.findMany({
      where: { school_id: schoolId, year: newYear, ...(cls != null && { class: cls }) },
      select: {
        id: true,
        student_id: true,
        class: true,
        section: true,
        roll: true,
        student: { select: { available: true } },
      },
    });
    return rows.map(({ student, ...r }) => ({ ...r, available: student.available }));
  }

  private async promotionPlan(schoolId: number, year: number) {
    const newYear = year + 1;
    const {
      rows: ranked,
      skipped,
      skippedStudents,
    } = await this.rank(schoolId, await this.completeResults(schoolId, year, PROMOTION_CLASSES));
    const studentIds = ranked.map((r) => r.result.studentId);
    const [nextRows, subjectsNextYear, newClass6] = await Promise.all([
      this.nextYearRows(schoolId, newYear),
      this.prisma.subjects.count({ where: { school_id: schoolId, year: newYear } }),
      // Newly admitted = next-year class 6 with no enrollment this year (Pending/skipped students have one).
      this.prisma.student_enrollments.count({
        where: {
          school_id: schoolId,
          year: newYear,
          class: DEFERRED_CLASS,
          student_id: { notIn: studentIds },
          student: { available: true, enrollments: { none: { school_id: schoolId, year } } },
        },
      }),
    ]);
    const inPlan = new Set(studentIds);
    const planRow = new Map(
      nextRows
        .filter((r) => inPlan.has(r.student_id))
        .map((r) => [`${r.student_id}|${r.class}`, r]),
    );

    // Odd merit → section A, even → B; a locked student already placed in its target class keeps that
    // row's section and its place in the order. Only auto-promoted students are reshuffled by a regen.
    const students = ranked.map(({ result: r, status, auto, fourthSubjectId, finalMerit }) => {
      const new_class = status === 'Passed' ? r.classLevel + 1 : r.classLevel;
      const kept = planRow.get(`${r.studentId}|${new_class}`);
      return {
        enrollment_id: r.enrollmentId,
        student_id: r.studentId,
        name: r.studentName,
        class: r.classLevel,
        section: r.section,
        roll: r.roll,
        group: r.group,
        status,
        auto,
        gpa: r.gpa,
        final_merit: finalMerit,
        new_class,
        new_section: !auto && kept ? kept.section : finalMerit % 2 === 1 ? 'A' : 'B',
        new_roll: null as number | null,
        /** Next-year row updated in place (keeps its marks) instead of re-created. */
        kept_id: kept?.id ?? null,
        kept_roll: kept?.roll ?? 0,
        fourth_subject_id: fourthSubjectId,
      };
    });
    const keptIds = new Set(students.map((s) => s.kept_id));
    const deleteIds = nextRows
      .filter((r) => inPlan.has(r.student_id) && !keptIds.has(r.id))
      .map((r) => r.id);
    const others = nextRows.filter((r) => !inPlan.has(r.student_id));

    // Class 7-10, per section: auto block 1..N in merit order, then locked students (kept rows and
    // other active students' rows) in their current roll order, then the newly locked by merit.
    // Inactive students' leftover rows go last so they never sit inside the active sequence.
    const renumbered: { id: number; student_id: number; roll: number }[] = [];
    for (const cls of PROMOTION_CLASSES.map((c) => c + 1)) {
      for (const section of ['A', 'B']) {
        const here = students.filter((s) => s.new_class === cls && s.new_section === section);
        const locked = [
          ...here
            .filter((s) => !s.auto && s.kept_id != null)
            .map((s) => ({ s, roll: s.kept_roll })),
          ...others
            .filter((r) => r.available && r.class === cls && r.section === section)
            .map((r) => ({ r, roll: r.roll })),
        ].sort((a, b) => a.roll - b.roll);
        const inactive = others
          .filter((r) => !r.available && r.class === cls && r.section === section)
          .sort((a, b) => a.roll - b.roll)
          .map((r) => ({ r }));
        const order = [
          ...here.filter((s) => s.auto).map((s) => ({ s })),
          ...locked,
          ...here.filter((s) => !s.auto && s.kept_id == null).map((s) => ({ s })),
          ...inactive,
        ];
        order.forEach((item, i) => {
          if ('s' in item) item.s.new_roll = i + 1;
          else if (item.r.roll !== i + 1) {
            renumbered.push({ id: item.r.id, student_id: item.r.student_id, roll: i + 1 });
          }
        });
      }
    }

    // Class 6 is never renumbered (admissions keep their rolls): kept rows stay, new ones append after.
    // With no class-6 admissions in `newYear` yet, new ones keep a null roll (waiting):
    // `assignRetained` numbers them after the admissions are imported.
    const class6Admissions = newClass6 > 0;
    const nextRoll = rollCounter([...others, ...nextRows.filter((r) => keptIds.has(r.id))]);
    for (const s of students.filter((s) => s.new_class === DEFERRED_CLASS)) {
      if (s.kept_id != null) s.new_roll = s.kept_roll;
      else if (class6Admissions) s.new_roll = nextRoll(DEFERRED_CLASS, s.new_section);
    }

    return {
      year,
      newYear,
      students,
      deleteIds,
      renumbered,
      skipped,
      skippedStudents,
      existingNextYear: nextRows.length - others.length,
      subjectsNextYear,
      class6Admissions,
    };
  }

  async previewPromotion(schoolId: number, year: number) {
    const {
      newYear,
      students,
      skipped,
      skippedStudents,
      existingNextYear,
      subjectsNextYear,
      class6Admissions,
    } = await this.promotionPlan(schoolId, year);
    return {
      year,
      newYear,
      students: students.map(
        ({ fourth_subject_id: _f, kept_id: _k, kept_roll: _r, auto, ...row }) => ({
          ...row,
          locked: !auto,
        }),
      ),
      skipped_students: skippedStudents,
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

  async promote(schoolId: number, year: number, ranBy: string | null = null) {
    const { newYear, students, deleteIds, renumbered, skipped } = await this.promotionPlan(
      schoolId,
      year,
    );
    if (!students.length) return { promoted: 0, awaitingRoll: 0, skipped, newYear };
    const placed = students.filter((s) => s.new_roll != null);
    const kept = placed.filter((s) => s.kept_id != null);
    const moves = [
      ...kept.map((s) => ({ id: s.kept_id!, section: s.new_section, roll: s.new_roll! })),
      ...renumbered.map(({ id, roll }) => ({ id, roll })),
    ];

    await rlsTransaction(async (tx) => {
      await this.assertNoNextYearMarks(tx, schoolId, newYear, deleteIds);
      const mapSubject = await this.subjectMapping(tx, schoolId, year, newYear);
      // Only rows leaving their class go; the rest are renumbered in place so their marks stay.
      await tx.student_enrollments.deleteMany({
        where: { school_id: schoolId, year: newYear, id: { in: deleteIds } },
      });
      // Two passes: park on a negative roll first so the (class, section, roll) unique never clashes.
      for (const m of moves) {
        await tx.student_enrollments.update({
          where: { id: m.id, school_id: schoolId },
          data: { roll: -m.id },
        });
      }
      for (const { id, ...data } of moves) {
        await tx.student_enrollments.update({ where: { id, school_id: schoolId }, data });
      }
      for (const r of renumbered) {
        await tx.student_enrollments.updateMany({
          where: {
            school_id: schoolId,
            year,
            student_id: r.student_id,
            next_year_section: { not: null },
          },
          data: { next_year_roll: r.roll },
        });
      }
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
        data: placed
          .filter((s) => s.kept_id == null)
          .map((s) => ({
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
      await this.recordRun(tx, schoolId, year, 'promotion', ranBy);
    }, TX_OPTIONS);

    return {
      promoted: placed.length,
      awaitingRoll: students.length - placed.length,
      skipped,
      newYear,
    };
  }

  /** Last run of a promotion/graduation for the year: one row per kind, overwritten on every run. */
  private recordRun(
    tx: Tx,
    schoolId: number,
    year: number,
    kind: 'promotion' | 'graduation',
    ranBy: string | null,
  ) {
    return tx.promotion_runs.upsert({
      where: { school_id_year_kind: { school_id: schoolId, year, kind } },
      create: { school_id: schoolId, year, kind, ran_by: ranBy },
      update: { ran_at: new Date(), ran_by: ranBy },
    });
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
    const {
      rows: ranked,
      skipped,
      skippedStudents,
    } = await this.rank(schoolId, await this.completeResults(schoolId, year, [10]));
    const inPlan = new Set(ranked.map((r) => r.result.studentId));
    const class10 = await this.nextYearRows(schoolId, newYear, 10);
    const rowOf = new Map(
      class10.filter((r) => inPlan.has(r.student_id)).map((r) => [r.student_id, r]),
    );

    // A retainee already placed keeps its row; new ones append after everyone else in the section.
    const keptOrOther = (r: (typeof class10)[number]) =>
      !inPlan.has(r.student_id) ||
      ranked.some((x) => x.result.studentId === r.student_id && x.status === 'Failed');
    const nextRoll = rollCounter(class10.filter(keptOrOther));
    const students = ranked.map(({ result: r, status, fourthSubjectId, finalMerit }) => {
      const graduate = status === 'Passed';
      const kept = graduate ? undefined : rowOf.get(r.studentId);
      const new_section = graduate ? null : (kept?.section ?? (finalMerit % 2 === 1 ? 'A' : 'B'));
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
        new_roll: kept ? kept.roll : new_section ? nextRoll(10, new_section) : null,
        kept: !!kept,
        fourth_subject_id: fourthSubjectId,
      };
    });
    // Graduates must not keep a class-10 row from an earlier run that retained them.
    const staleIds = class10
      .filter((r) => students.some((s) => s.action === 'graduate' && s.student_id === r.student_id))
      .map((r) => r.id);
    return {
      year,
      newYear,
      sscBatch,
      students,
      staleIds,
      skipped,
      skippedStudents,
      existingClass10NextYear: class10.length,
    };
  }

  async previewGraduation(schoolId: number, year: number) {
    const plan = await this.graduationPlan(schoolId, year);
    const graduates = plan.students.filter((s) => s.action === 'graduate').length;
    return {
      year,
      newYear: plan.newYear,
      sscBatch: plan.sscBatch,
      students: plan.students,
      skipped_students: plan.skippedStudents,
      summary: {
        total: plan.students.length,
        graduates,
        retained: plan.students.length - graduates,
        skipped: plan.skipped,
        existing_class10_next_year: plan.existingClass10NextYear,
      },
    };
  }

  async graduate(schoolId: number, year: number, ranBy: string | null = null) {
    const { newYear, sscBatch, students, staleIds, skipped } = await this.graduationPlan(
      schoolId,
      year,
    );
    const retained = students.filter((s) => s.action === 'retain' && !s.kept);
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
      await this.assertNoNextYearMarks(tx, schoolId, newYear, staleIds);
      if (staleIds.length) {
        await tx.student_enrollments.deleteMany({
          where: { school_id: schoolId, year: newYear, id: { in: staleIds } },
        });
      }
      if (retained.length) {
        const mapSubject = await this.subjectMapping(tx, schoolId, year, newYear);
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
      await this.recordRun(tx, schoolId, year, 'graduation', ranBy);
    }, TX_OPTIONS);

    return {
      graduated: graduates.length,
      retained: students.length - graduates.length,
      skipped,
      newYear,
      sscBatch,
    };
  }

  /**
   * Withhold results: status back to Pending so promotion/graduation skip them; they are not ranked until
   * released. After promotion, their next-year rows go too (held = not promoted).
   */
  async holdResults(schoolId: number, year: number, enrollmentIds: number[]) {
    const where = { school_id: schoolId, year, id: { in: enrollmentIds }, ...ACTIVE };
    const students = await this.prisma.student_enrollments.findMany({
      where,
      select: { student_id: true },
    });
    const nextRows = await this.prisma.student_enrollments.findMany({
      where: {
        school_id: schoolId,
        year: year + 1,
        student_id: { in: students.map((s) => s.student_id) },
      },
      select: { id: true },
    });
    const deleteIds = nextRows.map((r) => r.id);
    const count = await rlsTransaction(async (tx) => {
      await this.assertNoNextYearMarks(tx, schoolId, year + 1, deleteIds);
      if (deleteIds.length) {
        await tx.student_enrollments.deleteMany({
          where: { school_id: schoolId, year: year + 1, id: { in: deleteIds } },
        });
      }
      const res = await tx.student_enrollments.updateMany({
        where,
        data: {
          result_held: true,
          result_manual: false,
          status: 'Pending',
          final_merit: 0,
          fail_count: 0,
          release_batch: 0,
          result_released_at: null,
          next_year_section: null,
          next_year_roll: 0,
        },
      });
      return res.count;
    });
    return { held: count, removedNextYear: deleteIds.length };
  }

  /**
   * Release held results as one new batch: they rank after every earlier batch, so on-time merits never
   * move, and regenerating later keeps that order. Only the released rows are written. If the year is
   * already promoted, each released student is placed at the end of its next-year class right away.
   */
  async releaseResults(schoolId: number, year: number, enrollmentIds: number[]) {
    const held = await this.prisma.student_enrollments.findMany({
      where: { school_id: schoolId, year, id: { in: enrollmentIds }, result_held: true, ...ACTIVE },
      select: { id: true },
    });
    if (!held.length) {
      throw new BadRequestException(
        'None of these results are held, or the students are inactive (inactive students are not promoted).',
      );
    }
    const ids = held.map((e) => e.id);
    const { _max } = await this.prisma.student_enrollments.aggregate({
      where: { school_id: schoolId, year },
      _max: { release_batch: true },
    });
    const batch = (_max.release_batch ?? 0) + 1;
    await this.prisma.student_enrollments.updateMany({
      where: { school_id: schoolId, year, id: { in: ids } },
      data: { result_held: false, release_batch: batch, result_released_at: new Date() },
    });
    const generated = await this.createResults(schoolId, year, ids);

    // Merit order, one at a time: each placement sees the rolls the previous one took.
    const released = await this.prisma.student_enrollments.findMany({
      where: { school_id: schoolId, year, id: { in: ids } },
      select: { id: true, status: true },
      orderBy: { final_merit: 'asc' },
    });
    const placements = [];
    for (const e of released) {
      const plan = await this.placementPlan(schoolId, year, e.id, e.status);
      await rlsTransaction((tx) => this.applyPlacement(tx, schoolId, year, plan), TX_OPTIONS);
      placements.push(publicPlacement(plan));
    }
    return { batch, ...generated, placements };
  }

  /**
   * Manual pass/fail override. Wrong tenant/year or inactive student → 404. If the year is already
   * promoted, the student is moved in the same transaction (see `placementPlan`).
   */
  async updateResult(schoolId: number, year: number, enrollmentId: number, status: string) {
    const plan = await this.placementPlan(schoolId, year, enrollmentId, status);
    await rlsTransaction(async (tx) => {
      await tx.student_enrollments.update({
        where: { id: enrollmentId, school_id: schoolId, year },
        data: { status, result_manual: true },
      });
      await this.applyPlacement(tx, schoolId, year, plan);
    }, TX_OPTIONS);
    return publicPlacement(plan);
  }

  /** Dry run of `updateResult`'s placement, for the confirm dialog. */
  async previewPlacement(schoolId: number, year: number, enrollmentId: number, status: string) {
    return publicPlacement(await this.placementPlan(schoolId, year, enrollmentId, status));
  }

  /**
   * Where one student goes next year when its result changes after promotion/graduation already ran.
   * Nobody else moves: a new row goes to the end of the smaller section of the target class.
   * - not run yet for its class → `none` (the next promotion places it)
   * - Pending → `remove` its next-year rows
   * - class 10 Passed → `graduate`
   * - already in the target class → `unchanged`
   * - otherwise → `move` (failed class 6 with no admissions yet → roll null, waits for `assignRetained`)
   */
  private async placementPlan(
    schoolId: number,
    year: number,
    enrollmentId: number,
    status: string,
  ) {
    const newYear = year + 1;
    const e = await this.prisma.student_enrollments.findFirst({
      where: { id: enrollmentId, school_id: schoolId, year, ...ACTIVE },
      select: {
        id: true,
        student_id: true,
        class: true,
        group: true,
        fourth_subject_id: true,
        student: { select: { name: true } },
      },
    });
    if (!e) {
      throw new NotFoundException(
        `No enrollment in ${year} for this student, or the student is inactive (inactive students are not promoted).`,
      );
    }
    const base = {
      enrollmentId: e.id,
      studentId: e.student_id,
      name: e.student.name,
      class: e.class,
    };
    const ran = await this.prisma.student_enrollments.count({
      where: {
        school_id: schoolId,
        year,
        class: e.class,
        OR: [{ next_year_section: { not: null } }, { status: 'Graduated' }],
      },
    });
    if (!ran || status === 'Graduated') return { ...base, action: 'none' as const, deleteIds: [] };

    const own = await this.prisma.student_enrollments.findMany({
      where: { school_id: schoolId, year: newYear, student_id: e.student_id },
      select: { id: true, class: true, section: true, roll: true },
    });
    const ownIds = own.map((r) => r.id);
    if (status !== 'Passed' && status !== 'Failed') {
      return { ...base, action: 'remove' as const, deleteIds: ownIds };
    }
    if (status === 'Passed' && e.class === 10) {
      return { ...base, action: 'graduate' as const, deleteIds: ownIds };
    }

    const newClass = status === 'Passed' ? e.class + 1 : e.class;
    const kept = own.find((r) => r.class === newClass);
    if (kept) {
      return {
        ...base,
        action: 'unchanged' as const,
        newClass,
        newSection: kept.section,
        newRoll: kept.roll as number | null,
        deleteIds: ownIds.filter((id) => id !== kept.id),
      };
    }

    const [rows, admissions] = await Promise.all([
      this.nextYearRows(schoolId, newYear, newClass),
      newClass === DEFERRED_CLASS && status === 'Failed'
        ? this.prisma.student_enrollments.count({
            where: {
              school_id: schoolId,
              year: newYear,
              class: DEFERRED_CLASS,
              student: { available: true, enrollments: { none: { school_id: schoolId, year } } },
            },
          })
        : 1,
    ]);
    const active = (section: string) =>
      rows.filter((r) => r.available && r.section === section).length;
    const newSection = active('B') < active('A') ? 'B' : 'A';
    const maxRoll = Math.max(0, ...rows.filter((r) => r.section === newSection).map((r) => r.roll));
    return {
      ...base,
      action: 'move' as const,
      newClass,
      newSection,
      newRoll: admissions ? maxRoll + 1 : null,
      group: e.group,
      fourthSubjectId: e.fourth_subject_id,
      deleteIds: ownIds,
    };
  }

  private async applyPlacement(tx: Tx, schoolId: number, year: number, plan: Placement) {
    const newYear = year + 1;
    if (plan.action === 'none') return;
    await this.assertNoNextYearMarks(tx, schoolId, newYear, plan.deleteIds);
    if (plan.deleteIds.length) {
      await tx.student_enrollments.deleteMany({
        where: { school_id: schoolId, year: newYear, id: { in: plan.deleteIds } },
      });
    }
    const where = { id: plan.enrollmentId, school_id: schoolId };
    if (plan.action === 'remove') {
      await tx.student_enrollments.update({
        where,
        data: { next_year_section: null, next_year_roll: 0 },
      });
    } else if (plan.action === 'graduate') {
      await tx.student_enrollments.update({
        where,
        data: { status: 'Graduated', next_year_section: null, next_year_roll: 0 },
      });
      await tx.students.update({
        where: { id: plan.studentId, school_id: schoolId },
        data: { batch: String(newYear), available: false },
      });
    } else {
      if (plan.action === 'move' && plan.newRoll != null) {
        const mapSubject = await this.subjectMapping(tx, schoolId, year, newYear);
        await tx.student_enrollments.create({
          data: {
            school_id: schoolId,
            student_id: plan.studentId,
            class: plan.newClass,
            section: plan.newSection,
            roll: plan.newRoll,
            year: newYear,
            group: plan.group,
            status: 'Pending',
            fourth_subject_id: mapSubject(plan.fourthSubjectId, plan.newClass),
          },
        });
      }
      await tx.student_enrollments.update({
        where,
        data: { next_year_section: plan.newSection, next_year_roll: plan.newRoll ?? 0 },
      });
    }
  }

  /**
   * Next-year rows a correction would remove, with how many already have marks (those block it).
   * Promotion rows = students who were in classes 6-9 this year; graduation rows = this year's class 10
   * (retained). Admissions (no enrollment this year) are never touched.
   */
  private async correctionRows(schoolId: number, year: number, classes: number[]) {
    const rows = await this.prisma.student_enrollments.findMany({
      where: {
        school_id: schoolId,
        year: year + 1,
        student: { enrollments: { some: { school_id: schoolId, year, class: { in: classes } } } },
      },
      select: { id: true, _count: { select: { marks: true } } },
    });
    return { ids: rows.map((r) => r.id), withMarks: rows.filter((r) => r._count.marks > 0).length };
  }

  /** What each correction would change, for the "Correct mistakes" dialog. Nothing is written. */
  async previewCorrections(schoolId: number, year: number) {
    const [promotion, graduation, graduated, manual, batches, runs] = await Promise.all([
      this.correctionRows(schoolId, year, PROMOTION_CLASSES),
      this.correctionRows(schoolId, year, [10]),
      this.prisma.student_enrollments.count({
        where: { school_id: schoolId, year, class: 10, status: 'Graduated' },
      }),
      this.prisma.student_enrollments.count({
        where: { school_id: schoolId, year, result_manual: true, ...ACTIVE },
      }),
      this.prisma.student_enrollments.count({
        where: { school_id: schoolId, year, release_batch: { gt: 0 }, ...ACTIVE },
      }),
      this.prisma.promotion_runs.findMany({
        where: { school_id: schoolId, year },
        select: { kind: true },
      }),
    ]);
    const ran = (kind: string) => runs.some((r) => r.kind === kind);
    return {
      year,
      newYear: year + 1,
      reset_promotion: {
        available: promotion.ids.length > 0 || ran('promotion'),
        rows: promotion.ids.length,
        with_marks: promotion.withMarks,
      },
      undo_graduation: {
        available: graduated > 0 || ran('graduation'),
        graduated,
        rows: graduation.ids.length,
        with_marks: graduation.withMarks,
      },
      clear_manual: { available: manual > 0, students: manual },
      reset_release_batches: { available: batches > 0, students: batches },
    };
  }

  /**
   * Apply any mix of corrections in one transaction (refused if a removed row has marks), then
   * regenerate results when statuses or batches changed, and re-place students whose manual status
   * was cleared while the promotion stays.
   */
  async applyCorrections(schoolId: number, year: number, opts: CorrectionsInput) {
    if (!Object.values(opts).some(Boolean)) {
      throw new BadRequestException('Choose at least one correction.');
    }
    const newYear = year + 1;
    const [promotion, graduation] = await Promise.all([
      opts.reset_promotion
        ? this.correctionRows(schoolId, year, PROMOTION_CLASSES)
        : { ids: [], withMarks: 0 },
      opts.undo_graduation ? this.correctionRows(schoolId, year, [10]) : { ids: [], withMarks: 0 },
    ]);
    const blocked = promotion.withMarks + graduation.withMarks;
    if (blocked) {
      throw new BadRequestException(
        `${blocked} enrollment(s) in ${newYear} already have marks; nothing was changed. Remove those marks first.`,
      );
    }
    const manualIds = opts.clear_manual
      ? (
          await this.prisma.student_enrollments.findMany({
            where: { school_id: schoolId, year, result_manual: true, ...ACTIVE },
            select: { id: true },
          })
        ).map((e) => e.id)
      : [];

    const done = await rlsTransaction(async (tx) => {
      let graduated = 0;
      if (opts.undo_graduation) {
        const grads = await tx.student_enrollments.findMany({
          where: { school_id: schoolId, year, class: 10, status: 'Graduated' },
          select: { student_id: true },
        });
        graduated = grads.length;
        await tx.students.updateMany({
          where: { school_id: schoolId, id: { in: grads.map((g) => g.student_id) } },
          data: { available: true },
        });
        await tx.student_enrollments.updateMany({
          where: { school_id: schoolId, year, class: 10, status: 'Graduated' },
          data: { status: 'Passed' },
        });
        await tx.student_enrollments.deleteMany({
          where: { school_id: schoolId, year: newYear, id: { in: graduation.ids } },
        });
        await tx.student_enrollments.updateMany({
          where: { school_id: schoolId, year, class: 10 },
          data: { next_year_section: null, next_year_roll: 0 },
        });
        await tx.promotion_runs.deleteMany({
          where: { school_id: schoolId, year, kind: 'graduation' },
        });
      }
      if (opts.reset_promotion) {
        await tx.student_enrollments.deleteMany({
          where: { school_id: schoolId, year: newYear, id: { in: promotion.ids } },
        });
        await tx.student_enrollments.updateMany({
          where: { school_id: schoolId, year, class: { in: PROMOTION_CLASSES } },
          data: { next_year_section: null, next_year_roll: 0 },
        });
        await tx.promotion_runs.deleteMany({
          where: { school_id: schoolId, year, kind: 'promotion' },
        });
      }
      if (manualIds.length) {
        await tx.student_enrollments.updateMany({
          where: { school_id: schoolId, year, id: { in: manualIds } },
          data: { result_manual: false },
        });
      }
      const batches = opts.reset_release_batches
        ? (
            await tx.student_enrollments.updateMany({
              where: { school_id: schoolId, year, release_batch: { gt: 0 }, ...ACTIVE },
              data: { release_batch: 0 },
            })
          ).count
        : 0;
      return { graduated, batches };
    }, TX_OPTIONS);

    const regenerated = manualIds.length > 0 || done.batches > 0;
    if (regenerated) await this.createResults(schoolId, year);
    // Promotion kept: students whose manual status was cleared move if marks now say otherwise.
    const placements = [];
    if (!opts.reset_promotion) {
      for (const id of manualIds) {
        const e = await this.prisma.student_enrollments.findFirst({
          where: { id, school_id: schoolId },
          select: { status: true },
        });
        const plan = await this.placementPlan(schoolId, year, id, e?.status ?? 'Pending');
        await rlsTransaction((tx) => this.applyPlacement(tx, schoolId, year, plan), TX_OPTIONS);
        if (plan.action !== 'none' && plan.action !== 'unchanged') {
          placements.push(publicPlacement(plan));
        }
      }
    }
    return {
      year,
      newYear,
      promotion_rows_removed: promotion.ids.length,
      graduation_undone: done.graduated,
      graduation_rows_removed: graduation.ids.length,
      manual_cleared: manualIds.length,
      batches_reset: done.batches,
      regenerated,
      placements,
    };
  }

  /**
   * "Use calculated result": drop one student's manual pass/fail, recalculate it from marks and, if
   * already promoted, move the student when the result changed.
   */
  async clearOverride(schoolId: number, year: number, enrollmentId: number) {
    const { count } = await this.prisma.student_enrollments.updateMany({
      where: { id: enrollmentId, school_id: schoolId, year, result_manual: true, ...ACTIVE },
      data: { result_manual: false },
    });
    if (!count) {
      throw new NotFoundException(
        'This student has no manual pass/fail to clear, or is inactive (inactive students are not promoted).',
      );
    }
    await this.createResults(schoolId, year, [enrollmentId]);
    const e = await this.prisma.student_enrollments.findFirst({
      where: { id: enrollmentId, school_id: schoolId },
      select: { status: true },
    });
    const status = e?.status ?? 'Pending';
    const plan = await this.placementPlan(schoolId, year, enrollmentId, status);
    await rlsTransaction((tx) => this.applyPlacement(tx, schoolId, year, plan), TX_OPTIONS);
    return { status, ...publicPlacement(plan) };
  }

  async getStats(schoolId: number, year: number) {
    const newYear = year + 1;
    const base = { school_id: schoolId, year, student: { available: true } };
    const promotionWhere = { ...base, class: { in: PROMOTION_CLASSES } };
    const class10Where = { ...base, class: 10 };

    const [
      promotionByStatus,
      class10ByStatus,
      promotedCount,
      nextYearCount,
      awaitingRoll,
      unplaced,
      runs,
    ] = await Promise.all([
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
      this.prisma.student_enrollments.count({
        where: { school_id: schoolId, year: newYear, ...ACTIVE },
      }),
      this.prisma.student_enrollments.count({ where: this.awaitingRollWhere(schoolId, year) }),
      // Passed/Failed active students with no next-year place: promotion has not covered them yet.
      this.prisma.student_enrollments.count({
        where: {
          ...promotionWhere,
          status: { in: ['Passed', 'Failed'] },
          result_held: false,
          next_year_section: null,
        },
      }),
      this.prisma.promotion_runs.findMany({
        where: { school_id: schoolId, year },
        select: { kind: true, ran_at: true, ran_by: true },
      }),
    ]);
    const run = (kind: string) => {
      const r = runs.find((x) => x.kind === kind);
      return r ? { ran_at: r.ran_at, ran_by: r.ran_by } : null;
    };

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
      /** Only meaningful once promoted: results changed in bulk since (e.g. regenerated) → promote again. */
      unplaced: promotedCount > 0 ? unplaced : 0,
      promotion_run: run('promotion'),
      graduation_run: run('graduation'),
    };
  }
}
