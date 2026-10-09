import {
  computeStudentResult,
  rankStudents,
  type MarkInput,
  type StudentInput,
  type StudentSessionResult,
  type SubjectInput,
} from './session-result.js';
import { getPromotionEngine, PROMOTION_VERSIONS } from '../versions.js';

const PREV = 1;
const YE = 2;

const sub = (id: number, o: Partial<SubjectInput> = {}): SubjectInput => ({
  id,
  name: `S${id}`,
  class: 6,
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
  ...o,
});

const mark = (
  subject_id: number,
  exam_id: number,
  marks: number | null,
  o: Partial<MarkInput> = {},
): MarkInput => ({
  subject_id,
  exam_id,
  marks,
  cq_marks: null,
  mcq_marks: null,
  practical_marks: null,
  ...o,
});

const run = (o: Partial<StudentInput>) =>
  computeStudentResult({
    enrollmentId: 1,
    classLevel: 6,
    group: null,
    section: 'A',
    roll: 1,
    fourthSubjectId: null,
    subjects: [],
    marks: [],
    previousExamId: PREV,
    yearEndExamId: YE,
    ...o,
  });

/** Split a combined total across both exams (or year-end only for class 10). */
const marksFor = (classLevel: number, id: number, total: number) =>
  classLevel === 10
    ? [mark(id, YE, total)]
    : [mark(id, PREV, Math.floor(total / 2)), mark(id, YE, Math.ceil(total / 2))];

describe('v1 TOTAL pass table', () => {
  const rows: [classLevel: number, fullMark: number, threshold: number][] = [
    ...[6, 7, 8].flatMap((c): [number, number, number][] => [
      [c, 50, 30],
      [c, 100, 64],
    ]),
    [9, 200, 130],
    [9, 50, 30],
    [9, 100, 64],
    [10, 200, 64],
    [10, 50, 15],
    [10, 100, 30],
  ];

  it.each(rows)(
    'class %i full %i: pass at %i, fail one below',
    (classLevel, full_mark, threshold) => {
      const subjects = [sub(1, { class: classLevel, full_mark })];
      const pass = run({ classLevel, subjects, marks: marksFor(classLevel, 1, threshold) });
      expect(pass.subjects[0]).toMatchObject({ passed: true, passMark: threshold });
      expect(pass.isFailed).toBe(false);

      const fail = run({ classLevel, subjects, marks: marksFor(classLevel, 1, threshold - 1) });
      expect(fail.subjects[0]).toMatchObject({ passed: false, grade: 'F', gp: 0 });
      expect(fail).toMatchObject({ isFailed: true, failCount: 1, gpa: 0 });
    },
  );

  it.each([6, 7, 8])(
    'class %i Bangla (papers 100+50) aggregates into main: 98 passes, 97 fails',
    (classLevel) => {
      const subjects = [
        sub(10, {
          class: classLevel,
          name: 'Bangla',
          subject_type: 'main',
          full_mark: 0,
          pass_mark: 0,
        }),
        sub(11, { class: classLevel, subject_type: 'paper', parent_id: 10, full_mark: 100 }),
        sub(12, { class: classLevel, subject_type: 'paper', parent_id: 10, full_mark: 50 }),
      ];
      const at = (t: number) => [
        mark(11, PREV, 40),
        mark(12, PREV, 20),
        mark(11, YE, 20),
        mark(12, YE, t - 80),
      ];

      const pass = run({ classLevel, subjects, marks: at(98) });
      expect(pass.subjects).toHaveLength(1);
      expect(pass.subjects[0]).toMatchObject({
        subjectId: 10,
        name: 'Bangla',
        combined: 98,
        fullMark: 300,
        passMark: 98,
        passed: true,
        previous: { marks: 60 },
        yearEnd: { marks: 38 },
      });
      expect(run({ classLevel, subjects, marks: at(97) }).subjects[0].passed).toBe(false);
    },
  );

  it('falls back to pass_mark x M for full marks outside the table', () => {
    const r = run({
      subjects: [sub(1, { full_mark: 75, pass_mark: 25 })],
      marks: marksFor(6, 1, 50),
    });
    expect(r.subjects[0]).toMatchObject({ passMark: 50, passed: true });
  });
});

describe('v1 exams per class', () => {
  it('class 10 ignores the previous exam entirely', () => {
    const r = run({
      classLevel: 10,
      subjects: [sub(1, { class: 10 })],
      marks: [mark(1, PREV, 100), mark(1, YE, 29)],
    });
    expect(r.subjects[0]).toMatchObject({
      previous: null,
      combined: 29,
      fullMark: 100,
      passed: false,
    });
  });

  it('null marks count as 0 and fail', () => {
    const r = run({ subjects: [sub(1)], marks: [mark(1, PREV, null), mark(1, YE, null)] });
    expect(r.subjects[0]).toMatchObject({ combined: 0, passed: false, grade: 'F' });
    expect(r.isFailed).toBe(true);
  });

  it('ignores marks for subjects outside the class/group set', () => {
    const subjects = [
      sub(1, { class: 9, group: 'Science' }),
      sub(2, { class: 9, group: 'Humanities' }),
      sub(3, { class: 9 }),
    ];
    const r = run({
      classLevel: 9,
      group: 'Science',
      subjects,
      marks: [
        ...marksFor(9, 1, 80),
        ...marksFor(9, 2, 10),
        ...marksFor(9, 3, 80),
        mark(99, YE, 50),
      ],
    });
    expect(r.subjects.map((s) => s.subjectId)).toEqual([1, 3]);
    expect(r.totalMarks).toBe(160);
  });
});

describe('v1 BREAKDOWN subjects', () => {
  const physics = (classLevel: number) =>
    sub(1, {
      class: classLevel,
      marking_scheme: 'BREAKDOWN',
      full_mark: 100,
      pass_mark: 33,
      cq_mark: 70,
      cq_pass_mark: 23,
      mcq_mark: 30,
      mcq_pass_mark: 10,
    });
  const exam = (exam_id: number, cq: number, mcq: number) =>
    mark(1, exam_id, cq + mcq, { cq_marks: cq, mcq_marks: mcq });

  it('class 9 doubles component and total pass marks', () => {
    const subjects = [physics(9)];
    // CQ 46 / MCQ 20 / total 66 needed over two exams.
    expect(
      run({ classLevel: 9, subjects, marks: [exam(PREV, 23, 10), exam(YE, 23, 10)] }).subjects[0],
    ).toMatchObject({
      passed: true,
      passMark: 66,
    });
    expect(
      run({ classLevel: 9, subjects, marks: [exam(PREV, 22, 30), exam(YE, 23, 30)] }).subjects[0]
        .passed,
    ).toBe(false);
    expect(
      run({ classLevel: 9, subjects, marks: [exam(PREV, 60, 9), exam(YE, 60, 10)] }).subjects[0]
        .passed,
    ).toBe(false);
  });

  it('class 10 uses single pass marks', () => {
    const subjects = [physics(10)];
    expect(run({ classLevel: 10, subjects, marks: [exam(YE, 23, 10)] }).subjects[0]).toMatchObject({
      passed: true,
      passMark: 33,
    });
    expect(run({ classLevel: 10, subjects, marks: [exam(YE, 22, 30)] }).subjects[0].passed).toBe(
      false,
    );
  });
});

describe('v1 grading, continuous, 4th subject, GPA', () => {
  it('a pass below 33% is D 1.0, never F', () => {
    const r = run({ classLevel: 10, subjects: [sub(1, { class: 10 })], marks: [mark(1, YE, 30)] });
    expect(r.subjects[0]).toMatchObject({ passed: true, grade: 'D', gp: 1 });
    expect(r.gpa).toBe(1);
  });

  it('continuous subjects only count toward grandTotal', () => {
    const subjects = [
      sub(1),
      sub(2, { assessment_type: 'continuous', full_mark: 50, pass_mark: 0 }),
    ];
    const r = run({ subjects, marks: [...marksFor(6, 1, 160), mark(2, YE, 0), mark(2, PREV, 40)] });
    expect(r).toMatchObject({
      totalMarks: 160,
      grandTotal: 200,
      failCount: 0,
      isFailed: false,
      gpa: 5,
    });
    expect(r.subjects[1]).toMatchObject({ isContinuous: true, passed: true });
  });

  it('failing 4th subject does not fail the student; passing one adds gp-2', () => {
    const subjects = [sub(1, { class: 9 }), sub(2, { class: 9 }), sub(3, { class: 9 })];
    const base = [...marksFor(9, 1, 100), ...marksFor(9, 2, 100)]; // B 3.0 each

    const failed4th = run({
      classLevel: 9,
      fourthSubjectId: 3,
      subjects,
      marks: [...base, ...marksFor(9, 3, 10)],
    });
    expect(failed4th).toMatchObject({ isFailed: false, failCount: 0, gpa: 3, totalMarks: 210 });
    expect(failed4th.subjects[2]).toMatchObject({ isFourth: true, passed: false });

    const good4th = run({
      classLevel: 9,
      fourthSubjectId: 3,
      subjects,
      marks: [...base, ...marksFor(9, 3, 160)],
    });
    expect(good4th.gpa).toBe(4.5); // (3 + 3 + (5 - 2)) / 2
  });

  it('caps GPA at 5.00 and rounds to 2dp', () => {
    const subjects = [sub(1), sub(2), sub(3)];
    const capped = run({
      fourthSubjectId: 3,
      subjects: subjects.slice(0, 1).concat(subjects[2]),
      marks: [...marksFor(6, 1, 200), ...marksFor(6, 3, 200)],
    });
    expect(capped.gpa).toBe(5);
    const r = run({
      subjects,
      marks: [...marksFor(6, 1, 160), ...marksFor(6, 2, 160), ...marksFor(6, 3, 140)],
    });
    expect(r.gpa).toBe(4.67); // (5 + 5 + 4) / 3
  });

  it('maxAllowedFails tolerates failures', () => {
    const subjects = [sub(1), sub(2)];
    const marks = [...marksFor(6, 1, 160), ...marksFor(6, 2, 10)];
    expect(run({ subjects, marks })).toMatchObject({ failCount: 1, isFailed: true, gpa: 0 });
    expect(run({ subjects, marks, maxAllowedFails: 1 })).toMatchObject({
      failCount: 1,
      isFailed: false,
      gpa: 2.5,
    });
  });
});

describe('v1 rankStudents', () => {
  const res = (enrollmentId: number, o: Partial<StudentSessionResult>): StudentSessionResult => ({
    enrollmentId,
    classLevel: 6,
    group: null,
    section: 'A',
    roll: enrollmentId,
    subjects: [],
    totalMarks: 0,
    grandTotal: 0,
    gpa: 0,
    failCount: 0,
    isFailed: false,
    ...o,
  });

  it('orders passed first, then marks, GPA, section, roll', () => {
    const ranks = rankStudents([
      res(1, { isFailed: true, totalMarks: 999 }),
      res(2, { totalMarks: 500, gpa: 4 }),
      res(3, { totalMarks: 500, gpa: 4.5 }),
      res(4, { totalMarks: 600 }),
      res(5, { totalMarks: 500, gpa: 4, section: 'B', roll: 1 }),
      res(6, { totalMarks: 500, gpa: 4, roll: 7 }),
      res(7, { isFailed: true, totalMarks: 100 }),
    ]);
    expect([...ranks.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id)).toEqual([
      4, 3, 2, 6, 5, 1, 7,
    ]);
  });

  it('separates classes and class-10 groups; ignores group for 6-9', () => {
    const ranks = rankStudents([
      res(1, { classLevel: 9, group: 'Science', totalMarks: 10 }),
      res(2, { classLevel: 9, group: 'Humanities', totalMarks: 5 }),
      res(3, { classLevel: 9, group: 'Science', totalMarks: 20 }),
      res(4, { classLevel: 7, group: 'Science', totalMarks: 1 }),
      res(5, { classLevel: 7, group: null, totalMarks: 2 }),
      res(6, { classLevel: 10, group: 'Science', totalMarks: 1 }),
      res(7, { classLevel: 10, group: 'Humanities', totalMarks: 1 }),
    ]);
    expect(Object.fromEntries(ranks)).toEqual({ 1: 2, 2: 3, 3: 1, 4: 2, 5: 1, 6: 1, 7: 1 });
  });
});

describe('promotion versions registry', () => {
  it('falls back to v1 for unknown or empty versions', () => {
    expect(getPromotionEngine('v1')).toBe(PROMOTION_VERSIONS.v1);
    expect(getPromotionEngine(null)).toBe(PROMOTION_VERSIONS.v1);
    expect(getPromotionEngine('toString')).toBe(PROMOTION_VERSIONS.v1);
    expect(PROMOTION_VERSIONS.v1.examsForClass(10)).toBe('yearEndOnly');
    expect(PROMOTION_VERSIONS.v1.examsForClass(9)).toBe('both');
  });
});
