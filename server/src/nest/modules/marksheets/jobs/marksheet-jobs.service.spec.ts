import { jest } from '@jest/globals';
import type { PrismaClient } from '@/generated/prisma/client.js';

type Fn = (...args: any[]) => Promise<any>;

// No DB, no Redis, no R2, no pdfkit: collaborators are fakes passed to the constructor.
const r2 = {
  getFileBuffer: jest.fn<Fn>().mockResolvedValue(null),
  headObject: jest.fn<Fn>().mockResolvedValue(true),
  uploadToR2: jest.fn<Fn>().mockResolvedValue(undefined),
};
jest.unstable_mockModule('@/config/r2.js', () => r2);
jest.unstable_mockModule('@/config/prisma.js', () => ({ prisma: {} }));
jest.unstable_mockModule('@/utils/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.unstable_mockModule('@/utils/bullQueue.js', () => ({
  PRIORITY_BACKFILL: 2,
  PRIORITY_USER: 1,
  defaultJobOpts: (priority: number) => ({ priority }),
  enqueueUserPriority: jest.fn<Fn>().mockResolvedValue(undefined),
  ensureJobQueued: jest.fn<Fn>().mockResolvedValue(true),
}));
jest.unstable_mockModule('../pdf/marksheet-renderer.js', () => ({ MarksheetRenderer: class {} }));
jest.unstable_mockModule('../cache/marksheet-cache.service.js', () => ({
  MarksheetCacheService: class {},
}));
jest.unstable_mockModule('../cache/marksheet-hash.service.js', () => ({
  MarksheetHashService: class {},
}));
const { MarksheetJobsService } = await import('./marksheet-jobs.service.js');

const model = () => ({
  findFirst: jest.fn<Fn>().mockResolvedValue(null),
  findUnique: jest.fn<Fn>().mockResolvedValue(null),
  findMany: jest.fn<Fn>().mockResolvedValue([]),
  update: jest.fn<Fn>().mockResolvedValue({}),
  upsert: jest.fn<Fn>().mockResolvedValue({}),
  updateMany: jest.fn<Fn>().mockResolvedValue({ count: 1 }),
  createMany: jest.fn<Fn>().mockResolvedValue({ count: 0 }),
  delete: jest.fn<Fn>().mockResolvedValue({}),
});
const MODELS = [
  'exams',
  'marks',
  'marksheet_files',
  'marksheet_bundles',
  'marksheet_sessions',
  'student_enrollments',
  'teachers',
] as const;
let db: Record<(typeof MODELS)[number], ReturnType<typeof model>>;
let queue: { addBulk: jest.Mock<Fn>; getJob: jest.Mock<Fn> };
let hash: Record<string, jest.Mock<Fn>>;
let renderer: Record<string, jest.Mock<Fn>>;
let service: InstanceType<typeof MarksheetJobsService>;

const S = 7;
const studentJob = { studentId: 100, examId: 9, examName: 'HY', year: 2026, schoolId: S };
const fileWhere = { student_id_exam_id_school: { school_id: S, student_id: 100, exam_id: 9 } };

beforeEach(() => {
  jest.clearAllMocks();
  db = Object.fromEntries(MODELS.map((m) => [m, model()])) as typeof db;
  db.exams.findUnique.mockResolvedValue({ visible: true, result_date: null });
  queue = { addBulk: jest.fn<Fn>().mockResolvedValue([]), getJob: jest.fn<Fn>() };
  hash = {
    computeInputHash: jest.fn<Fn>().mockResolvedValue('h1'),
    computeBundleHash: jest.fn<Fn>().mockResolvedValue('b1'),
    computeSessionStudentHash: jest.fn<Fn>().mockResolvedValue('s1'),
    computeSessionYearHash: jest.fn<Fn>().mockResolvedValue('y1'),
  };
  renderer = {
    generateMarksheetPDF: jest.fn<Fn>().mockResolvedValue({
      buffer: Buffer.from('%PDF'),
      studentName: 'Rahim',
      usedHeadId: null,
      usedHeadRole: null,
      usedTeacherId: null,
      usedHeadName: null,
      usedHeadSignature: null,
      usedTeacherName: null,
      usedTeacherSignature: null,
      usedTeacherPhone: null,
    }),
    generateAllMarksheetsPDF: jest.fn<Fn>().mockResolvedValue(Buffer.from('%PDF')),
  };
  service = new MarksheetJobsService(
    db as unknown as PrismaClient,
    queue as any,
    hash as any,
    { invalidate: jest.fn() } as any,
    renderer as any,
  );
});

describe('enqueueForExam', () => {
  it('resets/creates rows for students with marks and bulk-queues one job each', async () => {
    db.marks.findMany.mockResolvedValue([
      { enrollment: { student_id: 100, year: 2026 } },
      { enrollment: { student_id: 101, year: 2026 } },
    ]);
    await expect(service.enqueueForExam(S, 9, 'HY')).resolves.toEqual({ queued: 2 });
    expect(db.marks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { school_id: S, exam_id: 9, marks: { not: null } } }),
    );
    expect(db.marksheet_files.updateMany).toHaveBeenCalledWith({
      where: { school_id: S, exam_id: 9, student_id: { in: [100, 101] } },
      data: { status: 'pending', error: null, exam_name: 'HY' },
    });
    expect(queue.addBulk.mock.calls[0][0].map((j: any) => j.opts.jobId)).toEqual([
      `ms:${S}:9:100`,
      `ms:${S}:9:101`,
    ]);
  });

  it('nothing to queue without marks', async () => {
    await expect(service.enqueueForExam(S, 9, 'HY')).resolves.toEqual({ queued: 0 });
    expect(queue.addBulk).not.toHaveBeenCalled();
  });
});

describe('processJob: student', () => {
  it('bails when another worker owns the row', async () => {
    db.marksheet_files.updateMany.mockResolvedValue({ count: 0 });
    await service.processJob(studentJob);
    expect(db.marksheet_files.updateMany).toHaveBeenCalledWith({
      where: { school_id: S, student_id: 100, exam_id: 9, status: { in: ['pending', 'failed'] } },
      data: { status: 'generating', attempts: { increment: 1 } },
    });
    expect(renderer.generateMarksheetPDF).not.toHaveBeenCalled();
  });

  it('skips render when inputs are unchanged and the object exists', async () => {
    db.marksheet_files.findUnique
      .mockResolvedValueOnce({ input_hash: 'h1', r2_key: 'k' }) // claimed row
      .mockResolvedValueOnce({ status: 'generating' }); // stale check
    await service.processJob(studentJob);
    expect(renderer.generateMarksheetPDF).not.toHaveBeenCalled();
    expect(db.marksheet_files.update).toHaveBeenCalledWith({
      where: fileWhere,
      data: { status: 'ready', error: null },
    });
  });

  it('renders, uploads and marks ready on first render', async () => {
    db.marksheet_files.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ status: 'generating' });
    await service.processJob(studentJob);
    expect(renderer.generateMarksheetPDF).toHaveBeenCalledWith(
      S,
      100,
      2026,
      'HY',
      expect.objectContaining({ role: 'admin' }),
      undefined,
    );
    expect(r2.uploadToR2).toHaveBeenCalledWith(
      `${S}/marksheets/2026/9/100.pdf`,
      expect.any(Buffer),
    );
    expect(db.marksheet_files.update).toHaveBeenLastCalledWith({
      where: fileWhere,
      data: expect.objectContaining({ status: 'ready', input_hash: 'h1', student_name: 'Rahim' }),
    });
  });

  it('deletes the row (no retry) when the student has no marks', async () => {
    renderer.generateMarksheetPDF.mockRejectedValue(new Error('No marks found for this student'));
    await expect(service.processJob(studentJob)).resolves.toBeUndefined();
    expect(db.marksheet_files.delete).toHaveBeenCalledWith({ where: fileWhere });
  });

  it('marks failed and rethrows other errors so Bull retries', async () => {
    renderer.generateMarksheetPDF.mockRejectedValue(new Error('render crashed'));
    await expect(service.processJob(studentJob)).rejects.toThrow('render crashed');
    expect(db.marksheet_files.update).toHaveBeenCalledWith({
      where: fileWhere,
      data: { status: 'failed', error: 'render crashed' },
    });
  });
});

describe('processJob: bundle / session dispatch', () => {
  it('bundle with no members ends as skipped, not failed', async () => {
    await service.processJob({
      kind: 'bundle',
      examId: 9,
      examName: 'HY',
      year: 2026,
      class: 6,
      schoolId: S,
    });
    expect(db.marksheet_bundles.update).toHaveBeenCalledWith({
      where: {
        exam_id_class_section_school: { school_id: S, exam_id: 9, class: 6, section: 'ALL' },
      },
      data: { status: 'skipped', error: null },
    });
  });

  it('session-year renders the all-students PDF under the year key', async () => {
    await service.processJob({ kind: 'session-year', year: 2026, schoolId: S });
    expect(renderer.generateAllMarksheetsPDF).toHaveBeenCalledWith(S, 2026, undefined);
    expect(r2.uploadToR2).toHaveBeenCalledWith(
      `${S}/marksheets/2026/session/all.pdf`,
      expect.any(Buffer),
    );
  });

  it('session-student renders one student', async () => {
    await service.processJob({ kind: 'session-student', studentId: 100, year: 2026, schoolId: S });
    expect(renderer.generateAllMarksheetsPDF).toHaveBeenCalledWith(S, 2026, 100);
    expect(hash.computeSessionStudentHash).toHaveBeenCalledWith(S, 100, 2026);
  });
});
