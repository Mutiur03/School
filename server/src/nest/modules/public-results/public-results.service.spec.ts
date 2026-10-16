import { jest } from '@jest/globals';
import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import type { PrismaClient } from '@/generated/prisma/client.js';

// CI runs without a real env (.env): stub the secret the token is signed with.
const env = { JWT_SECRET: 'test-secret' };
jest.unstable_mockModule('@/config/env.js', () => ({ env }));
const { PublicResultsService } = await import('./public-results.service.js');

type Fn = (...args: any[]) => Promise<any>;
const model = () => ({
  findFirst: jest.fn<Fn>().mockResolvedValue(null),
  findMany: jest.fn<Fn>().mockResolvedValue([]),
});
let db: Record<'exams' | 'student_enrollments' | 'marks', ReturnType<typeof model>>;
let service: InstanceType<typeof PublicResultsService>;
const S = 7;

beforeEach(() => {
  db = { exams: model(), student_enrollments: model(), marks: model() };
  service = new PublicResultsService(db as unknown as PrismaClient);
});

describe('listExams', () => {
  it('scopes to school/year/class, distinct names, nearest result date first', async () => {
    const today = new Date().toISOString().slice(0, 10);
    db.exams.findMany.mockResolvedValue([
      { exam_name: 'Old', result_date: '2000-01-01', visible: true },
      { exam_name: 'Now', result_date: today, visible: false },
      { exam_name: 'Now', result_date: null, visible: false },
      { exam_name: 'Undated', result_date: null, visible: true },
    ]);
    const res = await service.listExams(S, 2026, 6);
    expect(res.map((e) => e.exam_name)).toEqual(['Now', 'Old', 'Undated']);
    expect(db.exams.findMany.mock.calls[0][0]).toMatchObject({
      where: { school_id: S, exam_year: 2026, levels: { has: 6 } },
    });
  });
});

describe('verify', () => {
  const dto = { year: 2026, class: 6, section: 'A', roll: 3, phone: '01712345678' };

  it('no match → 401', async () => {
    await expect(service.verify(S, dto)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(db.student_enrollments.findFirst.mock.calls[0][0]).toMatchObject({
      where: {
        school_id: S,
        year: 2026,
        class: 6,
        section: 'A',
        roll: 3,
        student: {
          available: true,
          OR: [{ father_phone: dto.phone }, { mother_phone: dto.phone }],
        },
      },
    });
  });

  it('match → public_result token for the student + exams', async () => {
    db.student_enrollments.findFirst.mockResolvedValue({ student: { id: 100, name: 'Rafi' } });
    const res = await service.verify(S, dto);
    expect(res).toMatchObject({
      student: { id: 100, name: 'Rafi' },
      sessions: [{ year: 2026, exams: [] }],
    });
    expect(jwt.verify(res.token, env.JWT_SECRET)).toMatchObject({
      id: 100,
      schoolId: S,
      role: 'public_result',
    });
  });
});

describe('getExamResult', () => {
  it('unpublished → 403', async () => {
    await expect(service.getExamResult(S, 100, 2026, 'Annual')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(db.exams.findFirst).toHaveBeenCalledWith({
      where: { school_id: S, exam_name: 'Annual', visible: true },
      select: { id: true },
    });
  });

  it('no non-null marks → 404', async () => {
    db.exams.findFirst.mockResolvedValue({ id: 9 });
    db.marks.findMany.mockResolvedValue([{ marks: null }]);
    await expect(service.getExamResult(S, 100, 2026, 'Annual')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('sums papers into the main subject, ordered by priority', async () => {
    db.exams.findFirst.mockResolvedValue({ id: 9 });
    const enrollment = { roll: 3, class: 6, section: 'A', year: 2026, student: { name: 'Rafi' } };
    const exam = { exam_name: 'Annual', result_date: '2026-12-20' };
    db.marks.findMany.mockResolvedValue([
      {
        marks: 70,
        enrollment,
        exam,
        subject: { name: 'Math', priority: 2, full_mark: 100, parent: null },
      },
      {
        marks: 30,
        enrollment,
        exam,
        subject: { name: 'B1', priority: 1, full_mark: 50, parent: { name: 'Bangla' } },
      },
      {
        marks: 35,
        enrollment,
        exam,
        subject: { name: 'B2', priority: 1, full_mark: 50, parent: { name: 'Bangla' } },
      },
    ]);
    const res = await service.getExamResult(S, 100, 2026, 'Annual');
    expect(res).toEqual({
      student: { name: 'Rafi', roll: 3, class: 6, section: 'A', year: 2026 },
      exam_name: 'Annual',
      result_date: '2026-12-20',
      rows: [
        { subject: 'Bangla', marks: 65, full_mark: 100 },
        { subject: 'Math', marks: 70, full_mark: 100 },
      ],
      total: 135,
      total_full: 200,
    });
    expect(db.marks.findMany.mock.calls[0][0]).toMatchObject({
      where: {
        school_id: S,
        enrollment: { student_id: 100, year: 2026 },
        exam: { exam_name: 'Annual', visible: true },
      },
    });
  });
});
