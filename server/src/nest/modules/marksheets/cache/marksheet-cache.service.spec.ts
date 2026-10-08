import { jest } from '@jest/globals';
import {
  ForbiddenException,
  GatewayTimeoutException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaClient } from '@/generated/prisma/client.js';

type Fn = (...args: any[]) => Promise<any>;

// No DB, no Redis, no R2: serve polls fast so the timeout path is quick.
process.env.MARKSHEET_SERVE_TIMEOUT_MS = '60';
process.env.MARKSHEET_SERVE_POLL_MS = '5';

const r2 = {
  getFileBuffer: jest.fn<Fn>().mockResolvedValue(Buffer.from('%PDF')),
  getDownloadUrl: jest.fn<Fn>().mockResolvedValue('https://cdn.test/key.pdf'),
  headObject: jest.fn<Fn>().mockResolvedValue(true),
};
jest.unstable_mockModule('@/config/r2.js', () => r2);
jest.unstable_mockModule('@/config/prisma.js', () => ({ prisma: {} }));
jest.unstable_mockModule('@/utils/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
const enqueueUserPriority = jest.fn<Fn>().mockResolvedValue(undefined);
jest.unstable_mockModule('@/utils/bullQueue.js', () => ({
  PRIORITY_BACKFILL: 2,
  defaultJobOpts: (priority: number) => ({ priority }),
  enqueueUserPriority,
  ensureJobQueued: jest.fn(),
}));
jest.unstable_mockModule('../pdf/marksheet-renderer.js', () => ({ MarksheetRenderer: class {} }));
jest.unstable_mockModule('./marksheet-hash.service.js', () => ({ MarksheetHashService: class {} }));
const { MarksheetCacheService } = await import('./marksheet-cache.service.js');

const model = () => ({
  findFirst: jest.fn<Fn>().mockResolvedValue(null),
  findUnique: jest.fn<Fn>().mockResolvedValue(null),
  findMany: jest.fn<Fn>().mockResolvedValue([]),
  upsert: jest.fn<Fn>().mockResolvedValue({}),
  updateMany: jest.fn<Fn>().mockResolvedValue({ count: 0 }),
  createMany: jest.fn<Fn>().mockResolvedValue({ count: 0 }),
  deleteMany: jest.fn<Fn>().mockResolvedValue({ count: 0 }),
});
const MODELS = [
  'exams',
  'marks',
  'marksheet_files',
  'marksheet_bundles',
  'marksheet_sessions',
  'student_enrollments',
  'levels',
  'head_msg',
] as const;
let db: Record<(typeof MODELS)[number], ReturnType<typeof model>>;
let queue: { addBulk: jest.Mock<Fn> };
let hash: Record<string, jest.Mock<Fn>>;
let renderer: { verifyMarksheetDownloadAccess: jest.Mock<Fn> };
let service: InstanceType<typeof MarksheetCacheService>;

const S = 7; // school id
const admin = { id: 1, role: 'admin' } as any;

beforeEach(() => {
  jest.clearAllMocks();
  db = Object.fromEntries(MODELS.map((m) => [m, model()])) as typeof db;
  queue = { addBulk: jest.fn<Fn>().mockResolvedValue([]) };
  hash = {
    isStudentCacheFresh: jest.fn<Fn>().mockResolvedValue(false),
    isBundleCacheFresh: jest.fn<Fn>().mockResolvedValue(false),
    isSessionCacheFresh: jest.fn<Fn>().mockResolvedValue(null),
    computeSessionStudentHash: jest.fn<Fn>().mockResolvedValue('h1'),
    computeSessionYearHash: jest.fn<Fn>().mockResolvedValue('h1'),
  };
  renderer = { verifyMarksheetDownloadAccess: jest.fn<Fn>().mockResolvedValue(undefined) };
  service = new MarksheetCacheService(
    db as unknown as PrismaClient,
    queue as any,
    hash as any,
    renderer as any,
  );
});

describe('serve (per-student)', () => {
  beforeEach(() => db.exams.findFirst.mockResolvedValue({ id: 9 }));

  it('returns the cached PDF when fresh, without queueing', async () => {
    hash.isStudentCacheFresh.mockResolvedValue(true);
    db.marksheet_files.findUnique.mockResolvedValue({ r2_key: 'k', student_name: 'Rahim' });
    const out = await service.serve(S, 100, 2026, 'Half Yearly', admin);
    expect(out.studentName).toBe('Rahim');
    expect(renderer.verifyMarksheetDownloadAccess).toHaveBeenCalledWith(
      S,
      100,
      2026,
      'Half Yearly',
      admin,
    );
    expect(db.exams.findFirst).toHaveBeenCalledWith({
      where: { school_id: S, exam_name: 'Half Yearly', exam_year: 2026 },
      select: { id: true },
    });
    expect(enqueueUserPriority).not.toHaveBeenCalled();
  });

  it('500 when the exam does not exist', async () => {
    db.exams.findFirst.mockResolvedValue(null);
    await expect(service.serve(S, 100, 2026, 'X', admin)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('queues at user priority and fails fast with 500 when the worker marks it failed', async () => {
    db.marksheet_files.findUnique.mockResolvedValue({ status: 'failed', error: 'boom' });
    await expect(service.serve(S, 100, 2026, 'Half Yearly', admin)).rejects.toMatchObject({
      message: 'boom',
    });
    expect(db.marksheet_files.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { student_id_exam_id_school: { school_id: S, student_id: 100, exam_id: 9 } },
      }),
    );
    expect(enqueueUserPriority).toHaveBeenCalledWith(
      queue,
      { studentId: 100, examId: 9, examName: 'Half Yearly', year: 2026, schoolId: S },
      `ms:${S}:9:100`,
    );
  });

  it('404 when the worker skipped it (no marks)', async () => {
    db.marksheet_files.findUnique.mockResolvedValue({ status: 'skipped' });
    await expect(service.serve(S, 100, 2026, 'Half Yearly', admin)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('504 when the worker never produces a fresh PDF', async () => {
    db.marksheet_files.findUnique.mockResolvedValue({ status: 'pending' });
    await expect(service.serve(S, 100, 2026, 'Half Yearly', admin)).rejects.toBeInstanceOf(
      GatewayTimeoutException,
    );
  });
});

describe('serveBundle', () => {
  beforeEach(() => db.exams.findFirst.mockResolvedValue({ id: 9 }));
  const teacher = (section: string) =>
    ({ id: 2, role: 'teacher', levels: [{ class_name: 6, section, year: 2026 }] }) as any;

  it('403 for a teacher not assigned to the class', async () => {
    await expect(
      service.serveBundle(S, 2026, 7, 'Half Yearly', teacher('A')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('teacher scope defaults to their sections; fresh bundle → cache-busted url', async () => {
    hash.isBundleCacheFresh.mockResolvedValue(true);
    db.marksheet_bundles.findUnique.mockResolvedValue({
      r2_key: 'b.pdf',
      input_hash: 'abcdef0123456789zz',
    });
    const out = await service.serveBundle(S, 2026, 6, 'Half Yearly', teacher('A'));
    expect(out).toEqual({ url: 'https://cdn.test/key.pdf?v=abcdef0123456789' });
    expect(db.marksheet_bundles.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          exam_id_class_section_school: { school_id: S, exam_id: 9, class: 6, section: 'A' },
        },
      }),
    );
  });
});

describe('serveSession*', () => {
  it('404 when the session worker failed with "No marks found"', async () => {
    db.marksheet_sessions.findUnique.mockResolvedValue({
      status: 'failed',
      error: 'No marks found',
    });
    await expect(service.serveSessionStudent(S, 100, 2026, admin)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(hash.computeSessionStudentHash).toHaveBeenCalledWith(S, 100, 2026);
  });

  it('year PDF is admin only', async () => {
    await expect(
      service.serveSessionYear(S, 2026, { id: 3, role: 'teacher' } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('invalidate', () => {
  it('no-op when no student has marks', async () => {
    db.exams.findUnique.mockResolvedValue({ exam_name: 'HY', exam_year: 2026, result_date: null });
    await service.invalidate(S, [100], 9);
    expect(db.marks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ school_id: S, exam_id: 9 }) }),
    );
    expect(queue.addBulk).not.toHaveBeenCalled();
  });

  it('flags eligible rows pending, drops ineligible ones and queues student + bundle + session jobs', async () => {
    db.exams.findUnique.mockResolvedValue({
      exam_name: 'HY',
      exam_year: 2026,
      result_date: '2999-01-01',
    });
    db.marks.findMany.mockResolvedValue([{ enrollment: { student_id: 100 } }]);
    db.student_enrollments.findMany.mockResolvedValue([{ class: 6, section: 'A' }]);
    db.marksheet_files.findMany.mockResolvedValue([{ student_id: 100 }]);

    await service.invalidate(S, [100, 101], 9);

    expect(db.exams.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 9, school_id: S } }),
    );
    expect(db.marksheet_files.deleteMany).toHaveBeenCalledWith({
      where: {
        school_id: S,
        exam_id: 9,
        student_id: { in: [101] },
        status: { in: ['skipped', 'pending', 'failed'] },
      },
    });
    expect(db.marksheet_files.updateMany).toHaveBeenCalledWith({
      where: { school_id: S, exam_id: 9, student_id: { in: [100] } },
      data: { status: 'pending', error: null },
    });
    const jobIds = queue.addBulk.mock.calls.flatMap(([jobs]) =>
      (jobs as any[]).map((j) => j.opts.jobId),
    );
    expect(jobIds).toEqual(
      expect.arrayContaining([
        `ms:${S}:9:100`,
        `msb:${S}:9:6:ALL`,
        `msb:${S}:9:6:A`,
        `msy:${S}:2026`,
        `mss:${S}:2026:100`,
      ]),
    );
  });

  it('school signature change skips frozen exams', async () => {
    db.exams.findMany.mockResolvedValue([{ id: 1, result_date: '2000-01-01' }]);
    await service.invalidateForSchoolSignatureChange(S);
    expect(db.marksheet_files.updateMany).not.toHaveBeenCalled();
    expect(queue.addBulk).not.toHaveBeenCalled();
  });
});
