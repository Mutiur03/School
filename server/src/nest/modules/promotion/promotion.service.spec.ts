import { jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@/generated/prisma/client.js';
import type { PrismaClient } from '@/generated/prisma/client.js';

type Fn = (args?: any) => Promise<any>;

// rlsTransaction runs the callback on the same fake client: no DB.
jest.unstable_mockModule('@/config/prisma.js', () => ({
  prisma: {},
  rlsTransaction: (fn: (tx: unknown) => unknown) => fn(prisma),
}));
const { PromotionService } = await import('./promotion.service.js');

const model = () => ({
  findMany: jest.fn<Fn>().mockResolvedValue([]),
  findUniqueOrThrow: jest.fn<Fn>(),
  count: jest.fn<Fn>().mockResolvedValue(0),
  update: jest.fn<Fn>().mockResolvedValue({}),
  updateMany: jest.fn<Fn>().mockResolvedValue({}),
  upsert: jest.fn<Fn>().mockResolvedValue({}),
  createMany: jest.fn<Fn>().mockResolvedValue({}),
  deleteMany: jest.fn<Fn>().mockResolvedValue({}),
  groupBy: jest.fn<Fn>().mockResolvedValue([]),
});
const db = {
  school: model(),
  exams: model(),
  promotion_pass_rules: model(),
  student_enrollments: model(),
  subjects: model(),
  marks: model(),
  students: model(),
};
const prisma = db as unknown as PrismaClient;
const service = new PromotionService(prisma);

const S = 7; // school id
const YEAR = 2026;

const subject = (id: number, cls: number) => ({
  id,
  name: `S${id}`,
  class: cls,
  group: null,
  priority: id,
  parent_id: null,
  subject_type: 'single',
  assessment_type: 'exam',
  marking_scheme: 'TOTAL',
  full_mark: 100,
  pass_mark: 33,
  cq_mark: 0,
  mcq_mark: 0,
  practical_mark: 0,
  cq_pass_mark: 0,
  mcq_pass_mark: 0,
  practical_pass_mark: 0,
  year: YEAR,
  school_id: S,
  created_at: new Date(),
});

const enrollment = (id: number, cls: number, roll: number) => ({
  id,
  student_id: 100 + id,
  class: cls,
  group: null,
  section: 'A',
  roll,
  fourth_subject_id: null,
  student: { name: `Student ${id}` },
});

/**
 * One class with two exams (prev=1, year-end=2), one subject (id 10); marks given as [prev, yearEnd].
 * `saved` = saved status / fourth subject per enrollment (default Passed); `nextYear` = other students' next-year rows.
 */
const seedClass = (
  cls: number,
  marks: Record<number, [number, number]>,
  {
    exams = [1, 2],
    saved = {},
    nextYear = [],
  }: {
    exams?: number[];
    saved?: Record<number, { status?: string; fourth?: number }>;
    nextYear?: { class: number; section: string; roll: number }[];
  } = {},
) => {
  db.school.findUniqueOrThrow.mockResolvedValue({ promotionVersion: 'v1' });
  db.exams.findMany.mockResolvedValue(
    [
      { id: 1, levels: [cls], is_year_end: false, exam_type: { sort_order: 1 } },
      { id: 2, levels: [cls], is_year_end: true, exam_type: { sort_order: 2 } },
    ].filter((e) => exams.includes(e.id)),
  );
  const ids = Object.keys(marks).map(Number);
  db.student_enrollments.findMany.mockImplementation(async (args: any) =>
    args.select?.student
      ? ids.map((id, i) => enrollment(id, cls, i + 1))
      : args.select?.status
        ? ids.map((id) => ({
            id,
            status: saved[id]?.status ?? 'Passed',
            fourth_subject_id: saved[id]?.fourth ?? null,
          }))
        : nextYear,
  );
  db.subjects.findMany.mockResolvedValue([subject(10, cls)]);
  db.marks.findMany.mockResolvedValue(
    ids.flatMap((id) => [
      {
        enrollment_id: id,
        subject_id: 10,
        exam_id: 1,
        marks: marks[id][0],
        cq_marks: null,
        mcq_marks: null,
        practical_marks: null,
      },
      {
        enrollment_id: id,
        subject_id: 10,
        exam_id: 2,
        marks: marks[id][1],
        cq_marks: null,
        mcq_marks: null,
        practical_marks: null,
      },
    ]),
  );
};

afterEach(() => {
  jest.clearAllMocks();
  for (const m of Object.values(db)) {
    m.findMany.mockReset().mockResolvedValue([]);
    m.count.mockReset().mockResolvedValue(0);
  }
});

describe('loadSessionResults (via getResults)', () => {
  it('scopes every query by school_id and ranks the class', async () => {
    seedClass(6, { 1: [20, 30], 2: [40, 50], 3: [10, 10] });
    const out = await service.getResults(S, YEAR);

    expect(db.school.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: S } }),
    );
    expect(db.exams.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { school_id: S, exam_year: YEAR } }),
    );
    expect(db.promotion_pass_rules.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { school_id: S, year: YEAR } }),
    );
    expect(db.student_enrollments.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { school_id: S, year: YEAR, student: { available: true } },
      }),
    );
    expect(db.subjects.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { school_id: S, year: YEAR, class: { in: [6] } } }),
    );
    expect(db.marks.findMany.mock.calls[0][0].where).toMatchObject({ school_id: S });

    expect(out.version).toBe('v1');
    expect(out.results.map((r) => [r.enrollmentId, r.position, r.isFailed])).toEqual([
      [2, 1, false],
      [1, 2, true],
      [3, 3, true],
    ]);
  });

  it('flags classes without a previous exam but still computes them', async () => {
    seedClass(6, { 1: [0, 90] }, { exams: [2] });
    const out = await service.getResults(S, YEAR);
    expect(out.missingPrevious).toEqual([6]);
    expect(out.results).toHaveLength(1);
  });

  it('skips classes without a year-end exam', async () => {
    seedClass(6, { 1: [50, 50] }, { exams: [1] });
    const out = await service.getResults(S, YEAR);
    expect(out.missingYearEnd).toEqual([6]);
    expect(out.results).toEqual([]);
  });
});

describe('PromotionService.generateStatus', () => {
  it('writes status, fail_count and position with school_id', async () => {
    seedClass(6, { 1: [20, 30], 2: [40, 50] });
    await expect(service.generateStatus(S, YEAR)).resolves.toEqual({
      updated: 2,
      passed: 1,
      failed: 1,
      missingYearEnd: [],
      missingPrevious: [],
    });
    expect(db.student_enrollments.update).toHaveBeenCalledWith({
      where: { id: 2, school_id: S },
      data: { status: 'Passed', fail_count: 0, final_merit: 1 },
    });
    expect(db.student_enrollments.update).toHaveBeenCalledWith({
      where: { id: 1, school_id: S },
      data: { status: 'Failed', fail_count: 1, final_merit: 2 },
    });
  });

  it('class without a previous exam is reported, not written', async () => {
    seedClass(6, { 1: [0, 90] }, { exams: [2] });
    await expect(service.generateStatus(S, YEAR)).resolves.toMatchObject({
      updated: 0,
      missingPrevious: [6],
    });
    expect(db.student_enrollments.update).not.toHaveBeenCalled();
  });

  it('class without a year-end exam is reported, not written', async () => {
    seedClass(6, { 1: [50, 50] }, { exams: [1] });
    await expect(service.generateStatus(S, YEAR)).resolves.toMatchObject({
      updated: 0,
      missingYearEnd: [6],
    });
    expect(db.student_enrollments.update).not.toHaveBeenCalled();
  });
});

describe('PromotionService pass rules', () => {
  it('reads by school/year and fills missing classes with 0', async () => {
    db.promotion_pass_rules.findMany.mockResolvedValue([{ class: 9, max_failed: 2 }]);
    await expect(service.getPassRules(S, YEAR)).resolves.toEqual([
      { class: 6, max_failed: 0 },
      { class: 7, max_failed: 0 },
      { class: 8, max_failed: 0 },
      { class: 9, max_failed: 2 },
      { class: 10, max_failed: 0 },
    ]);
    expect(db.promotion_pass_rules.findMany).toHaveBeenCalledWith({
      where: { school_id: S, year: YEAR },
      select: { class: true, max_failed: true },
    });
  });

  it('upserts every class with school_id', async () => {
    await service.savePassRules(S, YEAR, [{ class: 8, max_failed: 1 }]);
    expect(db.promotion_pass_rules.upsert).toHaveBeenCalledTimes(5);
    expect(db.promotion_pass_rules.upsert).toHaveBeenCalledWith({
      where: { school_id_year_class: { school_id: S, year: YEAR, class: 8 } },
      create: { school_id: S, year: YEAR, class: 8, max_failed: 1 },
      update: { max_failed: 1 },
    });
  });
});

describe('PromotionService.promote', () => {
  const seedPromotion = () =>
    seedClass(
      6,
      { 1: [40, 50], 2: [45, 50], 3: [20, 20], 4: [50, 50] },
      {
        saved: { 1: { fourth: 11 }, 3: { status: 'Failed' }, 4: { status: 'Pending' } },
        nextYear: [{ class: 7, section: 'A', roll: 4 }], // another student's next-year row
      },
    );

  it('replaces only the plan students’ next-year rows, alternates sections, skips Pending', async () => {
    seedPromotion();
    await expect(service.promote(S, YEAR)).resolves.toEqual({
      promoted: 3,
      skipped: 1,
      newYear: YEAR + 1,
    });

    expect(db.student_enrollments.deleteMany).toHaveBeenCalledWith({
      where: { school_id: S, year: YEAR + 1, student_id: { in: [102, 101, 103] } },
    });
    const created = db.student_enrollments.createMany.mock.calls[0][0].data;
    expect(
      created.map((e: any) => [e.student_id, e.class, e.section, e.roll, e.school_id]),
    ).toEqual([
      [102, 7, 'A', 5, S], // merit 1 → A, after the reserved roll 4
      [101, 7, 'B', 1, S], // merit 2 → B
      [103, 6, 'A', 1, S], // failed → retained in 6
    ]);
    expect(db.student_enrollments.update).toHaveBeenCalledWith({
      where: { id: 2, school_id: S },
      data: { final_merit: 1, next_year_section: 'A', next_year_roll: 5 },
    });
  });

  it('maps the fourth subject to the promoted class’s subject', async () => {
    seedPromotion();
    db.subjects.findMany.mockImplementation(async (args: any) =>
      args.where.class // session-result load
        ? [subject(10, 6)]
        : args.where.year === YEAR
          ? [subject(10, 6), subject(11, 6)]
          : [
              { id: 61, name: 'S11', class: 6, group: null },
              { id: 71, name: 'S11', class: 7, group: null },
            ],
    );
    await service.promote(S, YEAR);
    const created = db.student_enrollments.createMany.mock.calls[0][0].data;
    expect(created.find((e: any) => e.student_id === 101).fourth_subject_id).toBe(71);
  });

  it('next-year rows with marks → 400, nothing deleted', async () => {
    seedPromotion();
    db.student_enrollments.count.mockImplementation(async (args: any) =>
      args.where.marks ? 2 : 0,
    );
    await expect(service.promote(S, YEAR)).rejects.toThrow(
      `2 enrollment(s) in ${YEAR + 1} already have marks`,
    );
    expect(db.student_enrollments.count).toHaveBeenCalledWith({
      where: {
        school_id: S,
        year: YEAR + 1,
        student_id: { in: [102, 101, 103] },
        marks: { some: {} },
      },
    });
    expect(db.student_enrollments.deleteMany).not.toHaveBeenCalled();
  });

  it('preview reports skipped students', async () => {
    seedPromotion();
    const preview = await service.previewPromotion(S, YEAR);
    expect(preview.summary).toMatchObject({ total: 3, skipped: 1 });
  });
});

describe('PromotionService.graduate', () => {
  // Year-end only for class 10 (pass mark 30/100). 3 is Pending: skipped, must not shift parity.
  const seedGraduation = () =>
    seedClass(
      10,
      { 1: [0, 80], 2: [0, 20], 3: [0, 25], 4: [0, 10] },
      { saved: { 2: { status: 'Failed' }, 3: { status: 'Pending' }, 4: { status: 'Failed' } } },
    );

  it('graduates Passed, retains Failed by merit, skips Pending', async () => {
    seedGraduation();
    await expect(service.graduate(S, YEAR)).resolves.toEqual({
      graduated: 1,
      retained: 2,
      skipped: 1,
      newYear: YEAR + 1,
      sscBatch: String(YEAR + 1),
    });
    expect(db.students.updateMany).toHaveBeenCalledWith({
      where: { school_id: S, id: { in: [101] } },
      data: { batch: String(YEAR + 1), available: false },
    });
    const created = db.student_enrollments.createMany.mock.calls[0][0].data;
    expect(created.map((e: any) => [e.student_id, e.class, e.section, e.roll])).toEqual([
      [102, 10, 'B', 1], // merit 2
      [104, 10, 'A', 1], // merit 3
    ]);
  });

  it('retained rows with next-year marks → 400', async () => {
    seedGraduation();
    db.student_enrollments.count.mockImplementation(async (args: any) =>
      args.where.marks ? 1 : 0,
    );
    await expect(service.graduate(S, YEAR)).rejects.toBeInstanceOf(BadRequestException);
    expect(db.student_enrollments.deleteMany).not.toHaveBeenCalled();
  });
});

describe('PromotionService.updateEnrollmentStatus', () => {
  it('updates with school_id in where', async () => {
    await service.updateEnrollmentStatus(S, 5, 'Failed');
    expect(db.student_enrollments.update).toHaveBeenCalledWith({
      where: { id: 5, school_id: S },
      data: { status: 'Failed' },
    });
  });

  it('P2025 bubbles up for global filter', async () => {
    db.student_enrollments.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('nf', { code: 'P2025', clientVersion: 'test' }),
    );
    await expect(service.updateEnrollmentStatus(S, 99, 'Passed')).rejects.toMatchObject({
      code: 'P2025',
    });
  });
});
