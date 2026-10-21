import { jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
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
  findFirst: jest.fn<Fn>().mockResolvedValue(null),
  count: jest.fn<Fn>().mockResolvedValue(0),
  update: jest.fn<Fn>().mockResolvedValue({}),
  updateMany: jest.fn<Fn>().mockResolvedValue({}),
  upsert: jest.fn<Fn>().mockResolvedValue({}),
  create: jest.fn<Fn>().mockResolvedValue({}),
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
  promotion_runs: model(),
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

const row = (
  id: number,
  student_id: number,
  cls: number,
  section: string,
  roll: number,
  available = true,
) => ({ id, student_id, class: cls, section, roll, student: { available } });
type NextYearRow = ReturnType<typeof row>;

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
    saved?: Record<number, { status?: string; fourth?: number; manual?: boolean }>;
    nextYear?: NextYearRow[];
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
    args.where?.year === YEAR + 1
      ? nextYear
      : args.select?.student
        ? ids.map((id, i) => ({
            ...enrollment(id, cls, i + 1),
            result_manual: !!saved[id]?.manual,
          }))
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
    m.findFirst.mockReset().mockResolvedValue(null);
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

describe('PromotionService.createResults', () => {
  it('writes status, fail_count and position with school_id', async () => {
    seedClass(6, { 1: [20, 30], 2: [40, 50] });
    await expect(service.createResults(S, YEAR)).resolves.toEqual({
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

  it('keeps the saved status of a manual override', async () => {
    seedClass(6, { 1: [20, 30], 2: [40, 50] }, { saved: { 1: { manual: true } } });
    await service.createResults(S, YEAR);
    expect(db.student_enrollments.update).toHaveBeenCalledWith({
      where: { id: 1, school_id: S },
      data: { fail_count: 1, final_merit: 2 },
    });
  });

  it('class without a previous exam is reported, not written', async () => {
    seedClass(6, { 1: [0, 90] }, { exams: [2] });
    await expect(service.createResults(S, YEAR)).resolves.toMatchObject({
      updated: 0,
      missingPrevious: [6],
    });
    expect(db.student_enrollments.update).not.toHaveBeenCalled();
  });

  it('class without a year-end exam is reported, not written', async () => {
    seedClass(6, { 1: [50, 50] }, { exams: [1] });
    await expect(service.createResults(S, YEAR)).resolves.toMatchObject({
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
        nextYear: [row(900, 900, 7, 'A', 4)], // another student's next-year row
      },
    );

  it('auto block first, other rows after it, alternates sections, skips Pending', async () => {
    seedPromotion();
    await expect(service.promote(S, YEAR)).resolves.toEqual({
      promoted: 2,
      awaitingRoll: 1,
      skipped: 1,
      newYear: YEAR + 1,
    });

    expect(db.student_enrollments.deleteMany).toHaveBeenCalledWith({
      where: { school_id: S, year: YEAR + 1, id: { in: [] } },
    });
    const created = db.student_enrollments.createMany.mock.calls[0][0].data;
    expect(
      created.map((e: any) => [e.student_id, e.class, e.section, e.roll, e.school_id]),
    ).toEqual([
      [102, 7, 'A', 1, S], // merit 1 → A, auto block first
      [101, 7, 'B', 1, S], // merit 2 → B
    ]); // failed class-6 student 103 gets no row until assignRetained
    // The other student's A4 moves to A2, right after the auto block; its source row follows.
    expect(db.student_enrollments.update).toHaveBeenCalledWith({
      where: { id: 900, school_id: S },
      data: { roll: 2 },
    });
    expect(db.student_enrollments.updateMany).toHaveBeenCalledWith({
      where: { school_id: S, year: YEAR, student_id: 900, next_year_section: { not: null } },
      data: { next_year_roll: 2 },
    });
    expect(db.student_enrollments.update).toHaveBeenCalledWith({
      where: { id: 3, school_id: S },
      data: { final_merit: 3, next_year_section: 'A', next_year_roll: 0 },
    });
    expect(db.student_enrollments.update).toHaveBeenCalledWith({
      where: { id: 2, school_id: S },
      data: { final_merit: 1, next_year_section: 'A', next_year_roll: 1 },
    });
  });

  it('records when and by whom it ran (one row per year, overwritten)', async () => {
    seedPromotion();
    await service.promote(S, YEAR, 'admin1');
    expect(db.promotion_runs.upsert).toHaveBeenCalledWith({
      where: { school_id_year_kind: { school_id: S, year: YEAR, kind: 'promotion' } },
      create: { school_id: S, year: YEAR, kind: 'promotion', ran_by: 'admin1' },
      update: { ran_at: expect.any(Date), ran_by: 'admin1' },
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

  it('rows leaving their class with next-year marks → 400, nothing deleted', async () => {
    seedClass(
      6,
      { 1: [40, 50], 3: [20, 20] },
      { saved: { 3: { status: 'Failed' } }, nextYear: [row(903, 103, 7, 'A', 1)] }, // 103 was promoted before
    );
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
        id: { in: [903] },
        marks: { some: {} },
      },
    });
    expect(db.student_enrollments.deleteMany).not.toHaveBeenCalled();
  });

  it('preview reports skipped students', async () => {
    seedPromotion();
    const preview = await service.previewPromotion(S, YEAR);
    expect(preview.summary).toMatchObject({ total: 3, skipped: 1, awaiting_roll: 1 });
    expect(preview.students.find((r) => r.student_id === 103)!.new_roll).toBeNull();
  });
});

describe('PromotionService.promote regen keeps the locked sequence', () => {
  // 1, 2, 4 pass on marks (auto); 5 fails on marks but was manually passed (locked).
  const seed = (nextYear: NextYearRow[]) =>
    seedClass(
      6,
      { 1: [40, 50], 2: [45, 50], 4: [38, 48], 5: [20, 20] },
      { saved: { 5: { manual: true } }, nextYear },
    );

  it('auto students reshuffle in 1..N; locked keep their order after the block', async () => {
    // From the earlier run: 105 already in 7B at roll 7, a stray student at 7B roll 2.
    seed([row(905, 105, 7, 'B', 7), row(950, 950, 7, 'B', 2)]);
    await service.promote(S, YEAR);

    const created = db.student_enrollments.createMany.mock.calls[0][0].data;
    expect(created.map((e: any) => [e.student_id, e.section, e.roll])).toEqual([
      [102, 'A', 1],
      [101, 'B', 1],
      [104, 'A', 2],
    ]); // 105 keeps its row: updated in place, not re-created
    expect(db.student_enrollments.update).toHaveBeenCalledWith({
      where: { id: 905, school_id: S },
      data: { roll: -905 },
    });
    expect(db.student_enrollments.update).toHaveBeenCalledWith({
      where: { id: 905, school_id: S },
      data: { section: 'B', roll: 3 }, // 7B: auto 101 → 1, stray (was 2) → 2, 105 (was 7) → 3
    });
    expect(db.student_enrollments.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 950, school_id: S } }),
    );
  });

  it('a locked student whose class changes is appended at the end of the new class', async () => {
    // 105 was retained in class 6 before the manual pass; that row goes.
    seed([row(905, 105, 6, 'A', 41), row(950, 950, 7, 'B', 2)]);
    const plan = await service.previewPromotion(S, YEAR);
    expect(plan.students.find((s) => s.student_id === 105)).toMatchObject({
      new_class: 7,
      new_section: 'B', // merit 4
      new_roll: 3, // after auto 101 and the stray row
      locked: true,
    });
    await service.promote(S, YEAR);
    expect(db.student_enrollments.deleteMany).toHaveBeenCalledWith({
      where: { school_id: S, year: YEAR + 1, id: { in: [905] } },
    });
  });

  it('a retained class-6 row is never renumbered', async () => {
    seedClass(
      6,
      { 1: [40, 50], 3: [20, 20] },
      {
        saved: { 3: { status: 'Failed' } },
        nextYear: [row(903, 103, 6, 'B', 41), row(950, 950, 6, 'B', 1)],
      },
    );
    db.student_enrollments.count.mockImplementation(async (args: any) =>
      args.where.student?.enrollments ? 1 : 0,
    );
    const plan = await service.previewPromotion(S, YEAR);
    expect(plan.students.find((s) => s.student_id === 103)).toMatchObject({
      new_section: 'B',
      new_roll: 41,
    });
  });
});

describe('PromotionService.promote with class-6 admissions already imported', () => {
  it('numbers failed class-6 students right away, after the admissions', async () => {
    seedClass(
      6,
      { 1: [40, 50], 3: [20, 20] },
      { saved: { 3: { status: 'Failed' } }, nextYear: [row(950, 950, 6, 'A', 9)] },
    );
    db.student_enrollments.count.mockImplementation(async (args: any) =>
      args.where.student?.enrollments ? 1 : 0,
    );
    await expect(service.promote(S, YEAR)).resolves.toMatchObject({
      promoted: 2,
      awaitingRoll: 0,
    });
    const created = db.student_enrollments.createMany.mock.calls[0][0].data;
    expect(created.map((e: any) => [e.student_id, e.class, e.section, e.roll])).toEqual([
      [101, 7, 'A', 1],
      [103, 6, 'B', 1], // merit 2 → B; admission holds A9, not B
    ]);
    const preview = await service.previewPromotion(S, YEAR);
    expect(preview.summary).toMatchObject({ class6_admissions: true, awaiting_roll: 0 });
  });
});

describe('PromotionService.promote admission check', () => {
  it('next-year class-6 rows of students enrolled this year do not count as admissions', async () => {
    seedClass(
      6,
      { 1: [40, 50], 3: [20, 20] },
      { saved: { 3: { status: 'Failed' } }, nextYear: [row(950, 950, 6, 'A', 9)] },
    );
    await expect(service.promote(S, YEAR)).resolves.toMatchObject({ awaitingRoll: 1 });
    expect(db.student_enrollments.count).toHaveBeenCalledWith({
      where: {
        school_id: S,
        year: YEAR + 1,
        class: 6,
        student_id: { notIn: [101, 103] },
        student: { available: true, enrollments: { none: { school_id: S, year: YEAR } } },
      },
    });
  });
});

describe('PromotionService.assignRetained', () => {
  const waiting = [
    { id: 3, student_id: 103, group: null, next_year_section: 'A', fourth_subject_id: null },
    { id: 5, student_id: 105, group: null, next_year_section: 'B', fourth_subject_id: null },
    { id: 7, student_id: 107, group: null, next_year_section: 'A', fourth_subject_id: null },
  ];

  it('numbers waiting students in merit order after the rolls already taken', async () => {
    db.student_enrollments.findMany.mockImplementation(async (args: any) =>
      args.orderBy ? waiting : [{ class: 6, section: 'A', roll: 12 }],
    );
    await expect(service.assignRetained(S, YEAR)).resolves.toEqual({
      assigned: 3,
      newYear: YEAR + 1,
    });

    expect(db.student_enrollments.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          school_id: S,
          year: YEAR,
          class: 6,
          status: 'Failed',
          next_year_roll: 0,
        }),
        orderBy: { final_merit: 'asc' },
      }),
    );
    const created = db.student_enrollments.create.mock.calls.map(([a]: any) => [
      a.data.student_id,
      a.data.class,
      a.data.section,
      a.data.roll,
      a.data.year,
      a.data.school_id,
    ]);
    expect(created).toEqual([
      [103, 6, 'A', 13, YEAR + 1, S],
      [105, 6, 'B', 1, YEAR + 1, S],
      [107, 6, 'A', 14, YEAR + 1, S],
    ]);
    expect(db.student_enrollments.update).toHaveBeenCalledWith({
      where: { id: 3, school_id: S },
      data: { next_year_roll: 13 },
    });
  });

  it('does nothing when nobody is waiting', async () => {
    await expect(service.assignRetained(S, YEAR)).resolves.toEqual({
      assigned: 0,
      newYear: YEAR + 1,
    });
    expect(db.student_enrollments.create).not.toHaveBeenCalled();
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

  it('graduates Passed (stays active), holds Failed, skips Pending', async () => {
    seedGraduation();
    await expect(service.graduate(S, YEAR)).resolves.toEqual({
      graduated: 1,
      held: 2,
      skipped: 1,
      newYear: YEAR + 1,
      sscBatch: String(YEAR + 1),
    });
    expect(db.students.updateMany).toHaveBeenCalledWith({
      where: { school_id: S, id: { in: [101] } },
      data: { batch: String(YEAR + 1) },
    });
    // Failed students get no next-year row; only merit is written for them.
    expect(db.student_enrollments.createMany).not.toHaveBeenCalled();
    expect(db.student_enrollments.update).toHaveBeenCalledWith({
      where: { id: 1, school_id: S },
      data: { final_merit: 1, next_year_section: null, next_year_roll: 0 },
    });
    expect(db.student_enrollments.update).toHaveBeenCalledWith({
      where: { id: 2, school_id: S },
      data: { final_merit: 2 },
    });
  });

  it('drops a graduate’s stale retained row', async () => {
    seedClass(
      10,
      { 1: [0, 80], 2: [0, 20] },
      {
        saved: { 2: { status: 'Failed' } },
        nextYear: [row(901, 101, 10, 'A', 3), row(902, 102, 10, 'A', 5)],
      },
    );
    await service.graduate(S, YEAR);
    expect(db.student_enrollments.deleteMany).toHaveBeenCalledWith({
      where: { school_id: S, year: YEAR + 1, id: { in: [901] } },
    });
  });

  it('stale next-year rows with marks → 400', async () => {
    seedClass(10, { 1: [0, 80] }, { nextYear: [row(901, 101, 10, 'A', 3)] });
    db.student_enrollments.count.mockImplementation(async (args: any) =>
      args.where.marks ? 1 : 0,
    );
    await expect(service.graduate(S, YEAR)).rejects.toBeInstanceOf(BadRequestException);
    expect(db.student_enrollments.deleteMany).not.toHaveBeenCalled();
  });
});

describe('PromotionService.retainFailed', () => {
  const failed = (id: number, merit: number) => ({
    id,
    student_id: 100 + id,
    group: null,
    fourth_subject_id: null,
    final_merit: merit,
  });

  it('puts Failed class-10 students in next year’s class 10 in merit order, after taken rolls', async () => {
    db.student_enrollments.findMany.mockImplementation(async (args: any) =>
      args.orderBy
        ? [failed(2, 2), failed(3, 3)]
        : [{ student_id: 900, class: 10, section: 'A', roll: 4 }],
    );
    await expect(service.retainFailed(S, YEAR)).resolves.toEqual({
      retained: 2,
      newYear: YEAR + 1,
    });
    expect(db.student_enrollments.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          school_id: S,
          year: YEAR,
          class: 10,
          status: 'Failed',
          next_year_section: null,
        }),
        orderBy: { final_merit: 'asc' },
      }),
    );
    const created = db.student_enrollments.create.mock.calls.map(([a]: any) => [
      a.data.student_id,
      a.data.class,
      a.data.section,
      a.data.roll,
      a.data.year,
      a.data.school_id,
    ]);
    expect(created).toEqual([
      [102, 10, 'B', 1, YEAR + 1, S], // merit 2 → B
      [103, 10, 'A', 5, YEAR + 1, S], // merit 3 → A, after A4
    ]);
    expect(db.student_enrollments.update).toHaveBeenCalledWith({
      where: { id: 3, school_id: S },
      data: { next_year_section: 'A', next_year_roll: 5 },
    });
  });

  it('does nothing when nobody is left Failed', async () => {
    await expect(service.retainFailed(S, YEAR)).resolves.toEqual({
      retained: 0,
      newYear: YEAR + 1,
    });
    expect(db.student_enrollments.create).not.toHaveBeenCalled();
  });
});

describe('PromotionService hold / release', () => {
  it('hold withholds: resets status and merit, scoped by school and year', async () => {
    db.student_enrollments.updateMany.mockResolvedValueOnce({ count: 2 });
    await expect(service.holdResults(S, YEAR, [1, 2])).resolves.toEqual({
      held: 2,
      removedNextYear: 0,
    });
    expect(db.student_enrollments.updateMany).toHaveBeenCalledWith({
      where: { school_id: S, year: YEAR, id: { in: [1, 2] }, student: { available: true } },
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
  });

  it('hold after promotion removes the next-year rows (held = not promoted)', async () => {
    db.student_enrollments.findMany.mockImplementation(async (args: any) =>
      args.where.year === YEAR + 1 ? [{ id: 901 }] : [{ student_id: 101 }],
    );
    db.student_enrollments.updateMany.mockResolvedValueOnce({ count: 1 });
    await expect(service.holdResults(S, YEAR, [1])).resolves.toEqual({
      held: 1,
      removedNextYear: 1,
    });
    expect(db.student_enrollments.findMany).toHaveBeenCalledWith({
      where: { school_id: S, year: YEAR + 1, student_id: { in: [101] } },
      select: { id: true },
    });
    expect(db.student_enrollments.deleteMany).toHaveBeenCalledWith({
      where: { school_id: S, year: YEAR + 1, id: { in: [901] } },
    });
  });

  it('release assigns the next batch to held rows only and writes only them', async () => {
    db.student_enrollments.findMany.mockResolvedValueOnce([{ id: 2 }]);
    (db.student_enrollments as unknown as { aggregate: jest.Mock<Fn> }).aggregate = jest
      .fn<Fn>()
      .mockResolvedValue({ _max: { release_batch: 1 } });
    const create = jest
      .spyOn(service, 'createResults')
      .mockResolvedValueOnce({ updated: 1 } as never);
    db.student_enrollments.updateMany.mockClear();

    await expect(service.releaseResults(S, YEAR, [1, 2])).resolves.toMatchObject({ batch: 2 });
    expect(db.student_enrollments.findMany).toHaveBeenCalledWith({
      where: {
        school_id: S,
        year: YEAR,
        id: { in: [1, 2] },
        result_held: true,
        student: { available: true },
      },
      select: { id: true },
    });
    expect(db.student_enrollments.updateMany).toHaveBeenCalledWith({
      where: { school_id: S, year: YEAR, id: { in: [2] } },
      data: { result_held: false, release_batch: 2, result_released_at: expect.any(Date) },
    });
    expect(create).toHaveBeenCalledWith(S, YEAR, [2]);
  });

  it('release 400s when nothing is held', async () => {
    db.student_enrollments.findMany.mockResolvedValueOnce([]);
    await expect(service.releaseResults(S, YEAR, [1])).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('PromotionService.updateResult / late placement', () => {
  const current = (cls: number) => ({
    id: 5,
    student_id: 105,
    class: cls,
    group: null,
    fourth_subject_id: null,
    student: { name: 'Rahim' },
  });
  /** `promoted` = the class already ran; `own` = the student's next-year rows; `target` = rows of the target class. */
  const seed = ({
    cls = 7,
    promoted = true,
    own = [] as { id: number; class: number; section: string; roll: number }[],
    target = [] as NextYearRow[],
    admissions = 1,
  }) => {
    db.student_enrollments.findFirst.mockResolvedValue(current(cls));
    db.student_enrollments.count.mockImplementation(async (args: any) =>
      args.where.next_year_section
        ? Number(promoted)
        : args.where.student?.enrollments
          ? admissions
          : 0,
    );
    db.promotion_runs.count.mockResolvedValue(Number(promoted)); // class 10: the recorded graduation run
    db.student_enrollments.findMany.mockImplementation(async (args: any) =>
      args.where.student_id ? own : target,
    );
  };

  it('before promotion: only the status changes', async () => {
    seed({ promoted: false });
    await expect(service.updateResult(S, YEAR, 5, 'Passed')).resolves.toMatchObject({
      action: 'none',
    });
    expect(db.student_enrollments.update).toHaveBeenCalledWith({
      where: { id: 5, school_id: S, year: YEAR },
      data: { status: 'Passed', result_manual: true },
    });
    expect(db.student_enrollments.create).not.toHaveBeenCalled();
  });

  it('manual pass after promotion: old row goes, new row at the end of the smaller section', async () => {
    seed({
      own: [{ id: 905, class: 7, section: 'A', roll: 30 }], // retained in class 7 before
      target: [
        row(1, 1, 8, 'A', 1),
        row(2, 2, 8, 'A', 2),
        row(3, 3, 8, 'B', 1),
        row(4, 4, 8, 'B', 9, false), // inactive still holds B9
      ],
    });
    await expect(service.previewPlacement(S, YEAR, 5, 'Passed')).resolves.toEqual({
      enrollment_id: 5,
      name: 'Rahim',
      class: 7,
      action: 'move',
      new_class: 8,
      new_section: 'B', // 1 active vs 2 in A
      new_roll: 10,
    });
    expect(db.student_enrollments.update).not.toHaveBeenCalled(); // preview writes nothing

    await service.updateResult(S, YEAR, 5, 'Passed');
    expect(db.student_enrollments.deleteMany).toHaveBeenCalledWith({
      where: { school_id: S, year: YEAR + 1, id: { in: [905] } },
    });
    expect(db.student_enrollments.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ student_id: 105, class: 8, section: 'B', roll: 10 }),
    });
    expect(db.student_enrollments.update).toHaveBeenCalledWith({
      where: { id: 5, school_id: S },
      data: { next_year_section: 'B', next_year_roll: 10 },
    });
  });

  it('already in the target class: nothing moves', async () => {
    seed({ own: [{ id: 905, class: 8, section: 'A', roll: 4 }] });
    await expect(service.updateResult(S, YEAR, 5, 'Passed')).resolves.toMatchObject({
      action: 'unchanged',
      new_section: 'A',
      new_roll: 4,
    });
    expect(db.student_enrollments.create).not.toHaveBeenCalled();
    expect(db.student_enrollments.deleteMany).not.toHaveBeenCalled();
  });

  it('failed class 6 with no admissions yet waits for assign retained', async () => {
    seed({ cls: 6, admissions: 0, own: [{ id: 905, class: 7, section: 'A', roll: 3 }] });
    await expect(service.updateResult(S, YEAR, 5, 'Failed')).resolves.toMatchObject({
      action: 'move',
      new_class: 6,
      new_roll: null,
    });
    expect(db.student_enrollments.create).not.toHaveBeenCalled();
    expect(db.student_enrollments.update).toHaveBeenCalledWith({
      where: { id: 5, school_id: S },
      data: { next_year_section: 'A', next_year_roll: 0 },
    });
  });

  it('class 10 passed after graduation: graduates, retained row removed', async () => {
    seed({ cls: 10, own: [{ id: 910, class: 10, section: 'A', roll: 7 }] });
    await expect(service.updateResult(S, YEAR, 5, 'Passed')).resolves.toMatchObject({
      action: 'graduate',
    });
    expect(db.student_enrollments.deleteMany).toHaveBeenCalledWith({
      where: { school_id: S, year: YEAR + 1, id: { in: [910] } },
    });
    expect(db.students.update).toHaveBeenCalledWith({
      where: { id: 105, school_id: S },
      data: { batch: String(YEAR + 1) },
    });
  });

  it('class 10 failed after graduation: held, no next-year row until retain', async () => {
    seed({ cls: 10 });
    await expect(service.updateResult(S, YEAR, 5, 'Failed')).resolves.toMatchObject({
      action: 'hold',
    });
    expect(db.student_enrollments.create).not.toHaveBeenCalled();
    expect(db.student_enrollments.deleteMany).not.toHaveBeenCalled();
  });

  it('old row with next-year marks → 400, status not saved', async () => {
    seed({ own: [{ id: 905, class: 7, section: 'A', roll: 30 }] });
    db.student_enrollments.count.mockImplementation(async (args: any) =>
      args.where.marks ? 3 : args.where.next_year_section ? 1 : 0,
    );
    await expect(service.updateResult(S, YEAR, 5, 'Passed')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(db.student_enrollments.deleteMany).not.toHaveBeenCalled();
  });

  it('missing or inactive → 404 with the reason, nothing written', async () => {
    await expect(service.updateResult(S, YEAR, 99, 'Passed')).rejects.toThrow(
      'or the student is inactive',
    );
    expect(db.student_enrollments.update).not.toHaveBeenCalled();
  });
});

describe('PromotionService inactive and skipped students', () => {
  it('preview lists skipped students with the reason', async () => {
    seedClass(6, { 1: [40, 50], 2: [45, 50] }, { saved: { 2: { status: 'Pending' } } });
    const preview = await service.previewPromotion(S, YEAR);
    expect(preview.skipped_students).toEqual([
      { enrollment_id: 2, name: 'Student 2', class: 6, section: 'A', roll: 2, reason: 'no_result' },
    ]);
  });

  it('an inactive student’s leftover next-year row goes after every active one', async () => {
    seedClass(
      6,
      { 1: [40, 50], 2: [45, 50], 3: [42, 50] },
      { nextYear: [row(960, 960, 7, 'A', 1, false), row(950, 950, 7, 'A', 3)] },
    );
    const plan = await service.previewPromotion(S, YEAR);
    // 7A: auto 102 → 1, 103 → 2; active stray (was 3) → 3; inactive (was 1) → 4.
    expect(plan.students.filter((s) => s.new_section === 'A').map((s) => s.new_roll)).toEqual([
      1, 2,
    ]);
    await service.promote(S, YEAR);
    expect(db.student_enrollments.update).toHaveBeenCalledWith({
      where: { id: 960, school_id: S },
      data: { roll: 4 },
    });
    expect(db.student_enrollments.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 950, school_id: S } }),
    );
  });
});

describe('PromotionService.getStats', () => {
  it('returns the last runs and students left without a next-year place', async () => {
    const ranAt = new Date('2026-12-20T10:00:00Z');
    db.promotion_runs.findMany.mockResolvedValue([
      { kind: 'promotion', ran_at: ranAt, ran_by: 'admin1' },
    ]);
    db.student_enrollments.count.mockImplementation(async (args: any) =>
      args.where.next_year_section === null ? 3 : args.where.next_year_section ? 10 : 0,
    );
    const stats = await service.getStats(S, YEAR);
    expect(stats).toMatchObject({
      promoted: true,
      unplaced: 3,
      promotion_run: { ran_at: ranAt, ran_by: 'admin1' },
      graduation_run: null,
    });
    expect(db.promotion_runs.findMany).toHaveBeenCalledWith({
      where: { school_id: S, year: YEAR },
      select: { kind: true, ran_at: true, ran_by: true },
    });
  });

  it('unplaced is 0 before any promotion', async () => {
    db.student_enrollments.count.mockImplementation(async (args: any) =>
      args.where.next_year_section === null ? 3 : 0,
    );
    await expect(service.getStats(S, YEAR)).resolves.toMatchObject({
      promoted: false,
      unplaced: 0,
    });
  });
});

describe('PromotionService corrections', () => {
  /** Next-year rows found for a correction: promotion = classes 6-9 this year, graduation = class 10. */
  const seedRows = (promo: number[], grad: number[], marked: number[] = []) =>
    db.student_enrollments.findMany.mockImplementation(async (args: any) => {
      const cls = args.where?.student?.enrollments?.some?.class?.in;
      if (cls) {
        const ids = cls.includes(10) ? grad : promo;
        return ids.map((id) => ({ id, _count: { marks: marked.includes(id) ? 2 : 0 } }));
      }
      if (args.where?.result_manual) return [{ id: 5 }];
      if (args.where?.status === 'Graduated') return [{ student_id: 110 }];
      return [];
    });

  it('preview counts what each correction would change', async () => {
    seedRows([901, 902], [910], [902]);
    db.student_enrollments.count.mockImplementation(async (args: any) =>
      args.where.status === 'Graduated'
        ? 68
        : args.where.result_manual
          ? 3
          : args.where.release_batch
            ? 2
            : 0,
    );
    db.promotion_runs.findMany.mockResolvedValue([{ kind: 'promotion' }]);
    await expect(service.previewCorrections(S, YEAR)).resolves.toEqual({
      year: YEAR,
      newYear: YEAR + 1,
      reset_promotion: { available: true, rows: 2, with_marks: 1 },
      undo_graduation: { available: true, graduated: 68, rows: 1, with_marks: 0 },
      clear_manual: { available: true, students: 3 },
      reset_release_batches: { available: true, students: 2 },
    });
  });

  it('nothing chosen → 400', async () => {
    await expect(service.applyCorrections(S, YEAR, {})).rejects.toThrow('Choose at least one');
  });

  it('a removed row with marks blocks everything', async () => {
    seedRows([901, 902], [], [902]);
    await expect(service.applyCorrections(S, YEAR, { reset_promotion: true })).rejects.toThrow(
      '1 enrollment(s) in 2027 already have marks; nothing was changed',
    );
    expect(db.student_enrollments.deleteMany).not.toHaveBeenCalled();
  });

  it('reset promotion removes its next-year rows and the run record only', async () => {
    seedRows([901, 902], [910]);
    await expect(
      service.applyCorrections(S, YEAR, { reset_promotion: true }),
    ).resolves.toMatchObject({
      promotion_rows_removed: 2,
      graduation_undone: 0,
      regenerated: false,
    });
    expect(db.student_enrollments.deleteMany).toHaveBeenCalledWith({
      where: { school_id: S, year: YEAR + 1, id: { in: [901, 902] } },
    });
    expect(db.student_enrollments.updateMany).toHaveBeenCalledWith({
      where: { school_id: S, year: YEAR, class: { in: [6, 7, 8, 9] } },
      data: { next_year_section: null, next_year_roll: 0 },
    });
    expect(db.promotion_runs.deleteMany).toHaveBeenCalledWith({
      where: { school_id: S, year: YEAR, kind: 'promotion' },
    });
    expect(db.students.updateMany).not.toHaveBeenCalled(); // graduation untouched
  });

  it('undo graduation makes alumni active Passed students again', async () => {
    seedRows([], [910]);
    await expect(
      service.applyCorrections(S, YEAR, { undo_graduation: true }),
    ).resolves.toMatchObject({
      graduation_undone: 1,
      graduation_rows_removed: 1,
    });
    expect(db.students.updateMany).toHaveBeenCalledWith({
      where: { school_id: S, id: { in: [110] } },
      data: { available: true },
    });
    expect(db.student_enrollments.updateMany).toHaveBeenCalledWith({
      where: { school_id: S, year: YEAR, class: 10, status: 'Graduated' },
      data: { status: 'Passed' },
    });
    expect(db.promotion_runs.deleteMany).toHaveBeenCalledWith({
      where: { school_id: S, year: YEAR, kind: 'graduation' },
    });
  });

  it('clear manual + reset batches: flags dropped, results regenerated', async () => {
    seedRows([], []);
    db.student_enrollments.updateMany.mockResolvedValue({ count: 2 });
    const regen = jest.spyOn(service, 'createResults').mockResolvedValueOnce({} as never);
    await expect(
      service.applyCorrections(S, YEAR, {
        clear_manual: true,
        reset_release_batches: true,
        reset_promotion: true,
      }),
    ).resolves.toMatchObject({ manual_cleared: 1, batches_reset: 2, regenerated: true });
    expect(db.student_enrollments.updateMany).toHaveBeenCalledWith({
      where: { school_id: S, year: YEAR, id: { in: [5] } },
      data: { result_manual: false },
    });
    expect(db.student_enrollments.updateMany).toHaveBeenCalledWith({
      where: { school_id: S, year: YEAR, release_batch: { gt: 0 }, student: { available: true } },
      data: { release_batch: 0 },
    });
    expect(regen).toHaveBeenCalledWith(S, YEAR);
  });

  it('use calculated result: 404 when there is no manual status', async () => {
    db.student_enrollments.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.clearOverride(S, YEAR, 5)).rejects.toThrow('no manual pass/fail to clear');
  });

  it('use calculated result: clears the flag and recalculates that student only', async () => {
    db.student_enrollments.updateMany.mockResolvedValueOnce({ count: 1 });
    const regen = jest.spyOn(service, 'createResults').mockResolvedValueOnce({} as never);
    db.student_enrollments.findFirst.mockImplementation(async (args: any) =>
      args.select.status
        ? { status: 'Failed' }
        : {
            id: 5,
            student_id: 105,
            class: 7,
            group: null,
            fourth_subject_id: null,
            student: { name: 'Rahim' },
          },
    );
    await expect(service.clearOverride(S, YEAR, 5)).resolves.toMatchObject({
      status: 'Failed',
      action: 'none', // not promoted yet
    });
    expect(db.student_enrollments.updateMany).toHaveBeenCalledWith({
      where: { id: 5, school_id: S, year: YEAR, result_manual: true, student: { available: true } },
      data: { result_manual: false },
    });
    expect(regen).toHaveBeenCalledWith(S, YEAR, [5]);
  });
});
