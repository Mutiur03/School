import { jest } from '@jest/globals';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@/generated/prisma/client.js';

type Fn = (...args: any[]) => Promise<any>;

// No DB, no Redis, no PDF engine: rlsTransaction runs on the fake client, marksheet cache calls are spies.
const executeRaw = jest.fn<Fn>().mockResolvedValue(0);
jest.unstable_mockModule('@/config/prisma.js', () => ({
  prisma: {},
  rlsTransaction: (fn: (tx: unknown) => unknown) => fn({ $executeRaw: executeRaw }),
}));
jest.unstable_mockModule('@/utils/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
const recomputeExamClassStats = jest.fn<Fn>().mockResolvedValue(false);
const loadSessionMarksheetPages = jest.fn<Fn>().mockResolvedValue({ version: 'v1', pages: [] });
const invalidate = jest.fn<Fn>().mockResolvedValue(undefined);
const invalidateClasses = jest.fn<Fn>().mockResolvedValue(undefined);
// Stub the provider modules so the spec never loads R2/Bull/pdfkit; fakes are passed to the constructor.
jest.unstable_mockModule('../marksheets/cache/marksheet-cache.service.js', () => ({
  MarksheetCacheService: class {},
}));
jest.unstable_mockModule('../marksheets/pdf/marksheet-renderer.js', () => ({
  MarksheetRenderer: class {},
}));
const { MarksService } = await import('./marks.service.js');

const model = () => ({
  findFirst: jest.fn<Fn>().mockResolvedValue(null),
  findMany: jest.fn<Fn>().mockResolvedValue([]),
  update: jest.fn<Fn>().mockResolvedValue({}),
  updateMany: jest.fn<Fn>().mockResolvedValue({ count: 0 }),
});
let db: Record<
  'exams' | 'student_enrollments' | 'subjects' | 'marks' | 'students',
  ReturnType<typeof model>
>;
let service: InstanceType<typeof MarksService>;

const S = 7; // school id
const YEAR = 2026;
const admin = { id: 1, role: 'admin' } as any;
const teacherOf = (section: string) =>
  ({ id: 2, role: 'teacher', levels: [{ class_name: 6, section, year: YEAR }] }) as any;
const enrollment = { id: 50, student_id: 100, class: 6, section: 'A', roll: 1 };

beforeEach(() => {
  jest.clearAllMocks();
  db = {
    exams: model(),
    student_enrollments: model(),
    subjects: model(),
    marks: model(),
    students: model(),
  };
  service = new MarksService(
    db as unknown as PrismaClient,
    { invalidate, invalidateClasses } as any,
    { recomputeExamClassStats, loadSessionMarksheetPages } as any,
  );
});

describe('saveMarks', () => {
  const dto = (subjectMarks: any[], studentId = 100) => ({
    examName: 'Annual',
    year: YEAR,
    students: [{ studentId, subjectMarks }],
  });
  const seed = (marking_scheme = 'TOTAL') => {
    db.exams.findFirst.mockResolvedValue({ id: 9, exam_name: 'Annual' });
    db.student_enrollments.findMany.mockResolvedValue([enrollment]);
    db.subjects.findMany.mockResolvedValue([{ id: 3, name: 'Math', marking_scheme }]);
  };
  /** Values bound into the bulk INSERT (Prisma.join flattens the row tuples). */
  const insertedValues = () => (executeRaw.mock.calls[0][1] as any).values;

  it('404 when the exam is not in this school/year', async () => {
    await expect(service.saveMarks(S, dto([]), admin)).rejects.toBeInstanceOf(NotFoundException);
    expect(db.exams.findFirst).toHaveBeenCalledWith({
      where: { school_id: S, exam_name: 'Annual', exam_year: YEAR },
    });
  });

  it('scopes lookups to the school and writes school_id in the upsert', async () => {
    seed();
    const res = await service.saveMarks(S, dto([{ subjectId: 3, marks: 80 }]), admin);

    expect(res).toEqual({ success: true, count: 1, errors: undefined });
    expect(db.student_enrollments.findMany).toHaveBeenCalledWith({
      where: { school_id: S, student_id: { in: [100] }, year: YEAR },
    });
    expect(db.subjects.findMany).toHaveBeenCalledWith({ where: { school_id: S, id: { in: [3] } } });
    expect(db.marks.findMany.mock.calls[0][0]).toMatchObject({
      where: { school_id: S, exam_id: 9 },
    });
    expect(insertedValues()).toEqual([S, 50, 3, 9, null, null, null, 80]);
    expect(recomputeExamClassStats).toHaveBeenCalledWith(expect.anything(), S, 9, 6, YEAR);
    expect(invalidate).toHaveBeenCalledWith(S, [100], 9);
    expect(invalidateClasses).not.toHaveBeenCalled();
  });

  it('BREAKDOWN subjects store cq + mcq + practical as the total', async () => {
    seed('BREAKDOWN');
    await service.saveMarks(
      S,
      dto([{ subjectId: 3, cq_marks: 40, mcq_marks: 25, practical_marks: null, marks: 999 }]),
      admin,
    );
    expect(insertedValues()).toEqual([S, 50, 3, 9, 40, 25, null, 65]);
  });

  it('BREAKDOWN with every part empty stores a null total', async () => {
    seed('BREAKDOWN');
    await service.saveMarks(S, dto([{ subjectId: 3, marks: 50 }]), admin);
    expect(insertedValues()).toEqual([S, 50, 3, 9, null, null, null, null]);
  });

  it('skips unchanged rows (no write, no invalidation)', async () => {
    seed();
    db.marks.findMany.mockResolvedValue([
      {
        enrollment_id: 50,
        subject_id: 3,
        cq_marks: null,
        mcq_marks: null,
        practical_marks: null,
        marks: 80,
      },
    ]);
    const res = await service.saveMarks(S, dto([{ subjectId: 3, marks: 80 }]), admin);
    expect(res.count).toBe(0);
    expect(executeRaw).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('invalidates whole classes when class-highest stats changed', async () => {
    seed();
    recomputeExamClassStats.mockResolvedValueOnce(true);
    await service.saveMarks(S, dto([{ subjectId: 3, marks: 80 }]), admin);
    expect(invalidateClasses).toHaveBeenCalledWith(S, 9, [6], YEAR);
  });

  it('teacher outside the section: reported, nothing written', async () => {
    seed();
    const res = await service.saveMarks(S, dto([{ subjectId: 3, marks: 80 }]), teacherOf('B'));
    expect(res).toEqual({
      success: true,
      count: 0,
      errors: ['Teacher 2 not authorized for Class 6 Section A'],
    });
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('reports unknown students and subjects', async () => {
    seed();
    const res = await service.saveMarks(
      S,
      {
        examName: 'Annual',
        year: YEAR,
        students: [
          { studentId: 999, subjectMarks: [{ subjectId: 3, marks: 1 }] },
          { studentId: 100, subjectMarks: [{ subjectId: 4, marks: 1 }] },
        ],
      },
      admin,
    );
    expect(res.errors).toEqual(['Student 999 not enrolled in 2026', 'Subject 4 not found']);
  });
});

describe('getRoster / getClassMarks access', () => {
  it('admin: school + class + year (+ section)', async () => {
    await service.getRoster(S, 6, YEAR, 'A', admin);
    expect(db.student_enrollments.findMany.mock.calls[0][0]).toMatchObject({
      where: { school_id: S, class: 6, year: YEAR, section: 'A' },
    });
  });

  it('teacher without section: limited to assigned sections', async () => {
    await service.getRoster(S, 6, YEAR, undefined, teacherOf('B'));
    expect(db.student_enrollments.findMany.mock.calls[0][0]).toMatchObject({
      where: { school_id: S, section: { in: ['B'] } },
    });
  });

  it('teacher: foreign section → 403, unassigned class → 403', async () => {
    await expect(service.getRoster(S, 6, YEAR, 'A', teacherOf('B'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.getClassMarks(S, 7, YEAR, 'Annual', teacherOf('B')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('class marks are scoped to the school and teacher sections', async () => {
    await service.getClassMarks(S, 6, YEAR, 'Annual', teacherOf('B'));
    expect(db.student_enrollments.findMany.mock.calls[0][0]).toMatchObject({
      where: { school_id: S, class: 6, year: YEAR, section: { in: ['B'] } },
    });
  });
});

describe('getStudentMarks', () => {
  const student = { id: 100, role: 'student' } as any;

  it('student: unpublished exam → 403', async () => {
    await expect(service.getStudentMarks(S, 100, YEAR, 'Annual', student)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(db.exams.findFirst).toHaveBeenCalledWith({
      where: { school_id: S, exam_name: 'Annual', exam_year: YEAR, visible: true },
      select: { id: true },
    });
  });

  it('student: someone else → 403', async () => {
    db.exams.findFirst.mockResolvedValue({ id: 9 });
    db.student_enrollments.findFirst.mockResolvedValue(enrollment);
    await expect(
      service.getStudentMarks(S, 100, YEAR, 'Annual', { id: 5, role: 'student' } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('not enrolled → 404', async () => {
    await expect(service.getStudentMarks(S, 100, YEAR, 'Annual', admin)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('student sees only visible exams; papers show under their main subject', async () => {
    db.exams.findFirst.mockResolvedValue({ id: 9 });
    db.student_enrollments.findFirst.mockResolvedValue(enrollment);
    db.marks.findMany.mockResolvedValue([
      { marks: 30, subject: { name: 'Bangla 1st', parent: { name: 'Bangla' } } },
      { marks: 70, subject: { name: 'Math', parent: null } },
    ]);
    const res = await service.getStudentMarks(S, 100, YEAR, 'Annual', student);
    expect(res).toEqual([
      { subject: 'Bangla', marks: 30 },
      { subject: 'Math', marks: 70 },
    ]);
    expect(db.marks.findMany.mock.calls[0][0]).toMatchObject({
      where: {
        school_id: S,
        enrollment: { student_id: 100, year: YEAR },
        exam: { exam_name: 'Annual', visible: true },
      },
    });
  });
});

describe('getSessionPreview', () => {
  it('passes schoolId to the session loader; null when no page', async () => {
    db.student_enrollments.findFirst.mockResolvedValue(enrollment);
    await expect(service.getSessionPreview(S, 100, YEAR, admin)).resolves.toBeNull();
    expect(loadSessionMarksheetPages).toHaveBeenCalledWith(S, YEAR, {
      classLevel: 6,
      enrollmentIds: [50],
    });
  });
});

describe('fourth subject', () => {
  it('single: update + invalidation scoped to the school', async () => {
    db.student_enrollments.findFirst.mockResolvedValue(enrollment);
    db.subjects.findFirst.mockResolvedValue({
      id: 12,
      class: 6,
      subject_type: 'single',
      group: null,
    });
    db.marks.findMany.mockResolvedValue([{ exam_id: 9 }]);
    await service.updateFourthSubject(S, 100, YEAR, 12, admin);
    expect(db.subjects.findFirst.mock.calls[0][0]).toMatchObject({
      where: { school_id: S, id: 12 },
    });
    expect(db.student_enrollments.update).toHaveBeenCalledWith({
      where: { id: 50, school_id: S },
      data: { fourth_subject_id: 12 },
    });
    expect(db.marks.findMany.mock.calls[0][0]).toMatchObject({ where: { school_id: S } });
    expect(invalidate).toHaveBeenCalledWith(S, [100], 9);
  });

  it('single: teacher of another section → 403', async () => {
    db.student_enrollments.findFirst.mockResolvedValue(enrollment);
    await expect(
      service.updateFourthSubject(S, 100, YEAR, null, teacherOf('B')),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.student_enrollments.update).not.toHaveBeenCalled();
  });

  it.each([
    [null, NotFoundException], // other school's subject id: not found in this school
    [{ id: 12, class: 7, subject_type: 'single', group: null }, BadRequestException],
    [{ id: 12, class: 6, subject_type: 'single', group: 'Science' }, BadRequestException],
  ])('single: subject %j rejected', async (subject, error) => {
    db.student_enrollments.findFirst.mockResolvedValue({ ...enrollment, group: null });
    db.subjects.findFirst.mockResolvedValue(subject);
    await expect(service.updateFourthSubject(S, 100, YEAR, 12, admin)).rejects.toBeInstanceOf(
      error,
    );
    expect(db.student_enrollments.update).not.toHaveBeenCalled();
  });

  const bulk = { class: 9, year: YEAR, group: 'Science', subjectId: 12 };
  it.each([
    [null, NotFoundException],
    [{ id: 12, class: 10, subject_type: 'single', group: null }, BadRequestException],
    [{ id: 12, class: 9, subject_type: 'main', group: null }, BadRequestException],
    [{ id: 12, class: 9, subject_type: 'paper', group: 'Commerce' }, BadRequestException],
  ])('bulk: subject %j rejected', async (subject, error) => {
    db.subjects.findFirst.mockResolvedValue(subject);
    await expect(service.bulkUpdateFourthSubject(S, bulk)).rejects.toBeInstanceOf(error);
    expect(db.subjects.findFirst.mock.calls[0][0]).toMatchObject({
      where: { school_id: S, id: 12 },
    });
    expect(db.student_enrollments.updateMany).not.toHaveBeenCalled();
  });

  it('bulk: updates the class group in this school', async () => {
    db.subjects.findFirst.mockResolvedValue({
      id: 12,
      class: 9,
      subject_type: 'single',
      group: 'Science',
    });
    db.student_enrollments.findMany.mockResolvedValue([{ id: 50, student_id: 100 }]);
    db.student_enrollments.updateMany.mockResolvedValue({ count: 1 });
    const res = await service.bulkUpdateFourthSubject(S, bulk);
    expect(res).toEqual({ updatedCount: 1, studentIds: [100] });
    expect(db.student_enrollments.findMany.mock.calls[0][0]).toMatchObject({
      where: { school_id: S, class: 9, year: YEAR, group: 'Science' },
    });
    expect(db.student_enrollments.updateMany).toHaveBeenCalledWith({
      where: { school_id: S, id: { in: [50] } },
      data: { fourth_subject_id: 12 },
    });
  });

  it('bulk: clearing skips the subject lookup; empty group → 0', async () => {
    const res = await service.bulkUpdateFourthSubject(S, { ...bulk, subjectId: null });
    expect(res).toEqual({ updatedCount: 0, studentIds: [] });
    expect(db.subjects.findFirst).not.toHaveBeenCalled();
  });
});
