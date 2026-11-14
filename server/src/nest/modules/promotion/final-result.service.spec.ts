import { jest } from '@jest/globals';
import type { PrismaClient } from '@/generated/prisma/client.js';

type Fn = (...args: any[]) => Promise<any>;

// Header + session loaders are covered elsewhere; stub them so this spec only exercises the PDF build.
const loadSchoolHeader = jest.fn<Fn>().mockResolvedValue({
  name: 'Test School',
  place: 'Panchbibi, Joypurhat',
  isGov: false,
});
const loadSessionResults = jest.fn<Fn>();
jest.unstable_mockModule('../../common/school-pdf.js', () => ({ loadSchoolHeader }));
jest.unstable_mockModule('./session-results.js', () => ({
  loadSessionResults,
  officialResult: (r: { saved: { status: string } }) => r.saved.status,
}));
const { FinalResultService } = await import('./final-result.service.js');

const findMany = jest.fn<Fn>();
const prisma = {
  student_enrollments: { findMany },
  exams: { findMany: jest.fn<Fn>().mockResolvedValue([]) },
} as unknown as PrismaClient;
const service = new FinalResultService(prisma);

const result = (enrollmentId: number, classLevel: number, position: number) => ({
  enrollmentId,
  classLevel,
  group: null,
  position,
  held: false,
  studentName: `Student ${enrollmentId}`,
  section: 'A',
  roll: position,
  gpa: 4.5,
  totalMarks: 500 + position,
  failCount: 0,
  saved: { status: 'Passed', merit: position, failCount: 0 },
});

beforeEach(() => jest.clearAllMocks());

test('builds a PDF from finalized results (many rows → multiple pages)', async () => {
  const results = Array.from({ length: 80 }, (_, i) => result(i + 1, 6, i + 1));
  loadSessionResults.mockResolvedValue({ results });
  findMany.mockResolvedValue(
    results.map((r) => ({
      id: r.enrollmentId,
      class: 6,
      status: 'Passed',
      final_merit: r.position,
      next_year_roll: r.position,
      next_year_section: 'A',
    })),
  );

  const pdf = await service.generate(7, 2025);

  expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { school_id: 7, year: 2025, student: { available: true } },
    }),
  );
  expect(loadSchoolHeader).toHaveBeenCalledWith(prisma, 7);
  expect(loadSessionResults).toHaveBeenCalledWith(prisma, 7, 2025);
  expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)?.length).toBeGreaterThan(1);
});

test('no results still produces a PDF', async () => {
  loadSessionResults.mockResolvedValue({ results: [] });
  findMany.mockResolvedValue([]);

  const pdf = await service.generate(7, 2025);

  expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
});

test('classes filter keeps only those classes', async () => {
  const results = [result(1, 6, 1), result(2, 7, 1)];
  loadSessionResults.mockResolvedValue({ results });
  findMany.mockResolvedValue(
    results.map((r) => ({ id: r.enrollmentId, class: r.classLevel, next_year_roll: 1 })),
  );
  const all = (await service.generate(7, 2025)).toString('latin1');
  const only7 = (await service.generate(7, 2025, [7])).toString('latin1');
  const pages = (pdf: string) => pdf.match(/\/Type \/Page\b/g)?.length;
  expect(pages(all)).toBe(2); // one page per class
  expect(pages(only7)).toBe(1);
});
