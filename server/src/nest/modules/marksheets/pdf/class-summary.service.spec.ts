import { jest } from '@jest/globals';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@/generated/prisma/client.js';

type Fn = (...args: any[]) => Promise<any>;

// No DB: fake Prisma + renderer; pdfkit renders in memory.
jest.unstable_mockModule('@/config/prisma.js', () => ({ prisma: {} }));
jest.unstable_mockModule('./marksheet-renderer.js', () => ({ MarksheetRenderer: class {} }));
const { ClassSummaryService } = await import('./class-summary.service.js');

const S = 7;
const subject = {
  id: 1,
  name: 'Bangla',
  priority: 1,
  assessment_type: 'exam',
  full_mark: 100,
  pass_mark: 33,
  subject_type: 'single',
  parent_id: null,
  group: null,
  parent: null,
};
const enrollment = (roll: number, marks: number | null) => ({
  id: roll,
  roll,
  section: 'A',
  group: null,
  fourth_subject_id: null,
  student: { id: roll, name: `Student ${roll}` },
  marks: [{ subject_id: 1, exam_id: 9, marks, subject, exam: { id: 9, exam_name: 'HY' } }],
});

let db: any;
let service: InstanceType<typeof ClassSummaryService>;
const admin = { id: 1, role: 'admin' } as any;

beforeEach(() => {
  db = {
    school: { findUnique: jest.fn<Fn>().mockResolvedValue({ name: 'Test School' }) },
    student_enrollments: {
      findMany: jest.fn<Fn>().mockResolvedValue([enrollment(1, 80), enrollment(2, 20)]),
    },
  };
  const renderer = {
    loadMarksheetSubjects: jest.fn<Fn>().mockResolvedValue([subject]),
    shouldApplyFourthSubjectBonus: jest.fn<Fn>().mockResolvedValue(false),
  };
  service = new ClassSummaryService(db as unknown as PrismaClient, renderer as any);
});

it('renders a PDF for the class, scoped to the school, with a stable filename', async () => {
  const { buffer, filename } = await service.generateClassSummaryPDF(
    S,
    6,
    2026,
    'Half Yearly',
    admin,
    'A',
  );
  expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  expect(filename).toBe('6A_Summary_Half_Yearly_2026.pdf');
  expect(db.student_enrollments.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { school_id: S, class: 6, year: 2026, section: 'A' } }),
  );
});

it('teacher without a section query is limited to assigned sections', async () => {
  const teacher = {
    id: 2,
    role: 'teacher',
    levels: [{ class_name: 6, section: 'B', year: 2026 }],
  } as any;
  await service.generateClassSummaryPDF(S, 6, 2026, 'HY', teacher);
  expect(db.student_enrollments.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { school_id: S, class: 6, year: 2026, section: { in: ['B'] } },
    }),
  );
});

it('403 for a teacher not assigned to the class', async () => {
  await expect(
    service.generateClassSummaryPDF(S, 6, 2026, 'HY', {
      id: 2,
      role: 'teacher',
      levels: [],
    } as any),
  ).rejects.toBeInstanceOf(ForbiddenException);
});

it('404 when nobody has marks', async () => {
  db.student_enrollments.findMany.mockResolvedValue([enrollment(1, null)]);
  await expect(service.generateClassSummaryPDF(S, 6, 2026, 'HY', admin)).rejects.toBeInstanceOf(
    NotFoundException,
  );
});
