import { jest } from '@jest/globals';
import type { PrismaClient } from '@/generated/prisma/client.js';

type Fn = (...args: any[]) => Promise<any>;

// No DB, no R2: fingerprints come from a fake Prisma.
jest.unstable_mockModule('@/config/r2.js', () => ({
  headObject: jest.fn<Fn>().mockResolvedValue(true),
  headObjectEtag: jest.fn<Fn>().mockResolvedValue('etag'),
}));
jest.unstable_mockModule('@/config/prisma.js', () => ({ prisma: {} }));
const { MarksheetHashService } = await import('./marksheet-hash.service.js');

const S = 7;
let db: any;
let service: InstanceType<typeof MarksheetHashService>;

beforeEach(() => {
  const fn = (v: unknown = null) => jest.fn<Fn>().mockResolvedValue(v);
  db = {
    student_enrollments: {
      findFirst: fn({ class: 6, section: 'A', roll: 1, fourth_subject_id: null, school_id: S }),
      findMany: fn([]),
    },
    exams: {
      findUnique: fn({ exam_name: 'HY', result_date: '2999-01-01', school_id: S, visible: true }),
    },
    marksheet_files: { findUnique: fn() },
    marksheet_bundles: { findUnique: fn() },
    marksheet_sessions: { findUnique: fn() },
    marks: {
      aggregate: fn({ _count: { _all: 3 }, _max: { updated_at: new Date('2026-01-01') } }),
    },
    exam_class_stats: { findFirst: fn() },
    head_msg: { findFirst: fn() },
    levels: { findMany: fn([]) },
    teachers: { findUnique: fn() },
    school: { findUnique: fn() },
    promotion_pass_rules: { findUnique: fn() },
  };
  service = new MarksheetHashService(db as unknown as PrismaClient);
});

describe('computeInputHash', () => {
  it('is stable for the same inputs and scopes every query to the school', async () => {
    const a = await service.computeInputHash(S, 100, 9, 2026);
    const b = await service.computeInputHash(S, 100, 9, 2026);
    expect(a).toBe(b);
    expect(db.exams.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 9, school_id: S } }),
    );
    expect(db.marks.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { school_id: S, exam_id: 9, enrollment: { student_id: 100, year: 2026 } },
      }),
    );
    expect(db.head_msg.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { school_id: S } }),
    );
  });

  it('changes when a mark changes', async () => {
    const before = await service.computeInputHash(S, 100, 9, 2026);
    db.marks.aggregate.mockResolvedValue({
      _count: { _all: 3 },
      _max: { updated_at: new Date('2026-02-01') },
    });
    expect(await service.computeInputHash(S, 100, 9, 2026)).not.toBe(before);
  });
});

describe('isSessionCacheFresh', () => {
  it('fresh only for a ready row whose hash matches', async () => {
    db.marksheet_sessions.findUnique.mockResolvedValue({
      status: 'ready',
      input_hash: 'h',
      r2_key: 'k',
    });
    expect(await service.isSessionCacheFresh(S, 2026, 0, 'h')).toEqual({ r2_key: 'k' });
    expect(await service.isSessionCacheFresh(S, 2026, 0, 'other')).toBeNull();
  });
});
