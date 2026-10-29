import { jest } from '@jest/globals';

type Fn = (...args: any[]) => Promise<any>;
const db = {
  teachers: { findFirst: jest.fn<Fn>() },
  levels: { findUnique: jest.fn<Fn>(), create: jest.fn<Fn>(), update: jest.fn<Fn>() },
};
jest.unstable_mockModule('@/config/prisma.js', () => ({ prisma: db }));
jest.unstable_mockModule('@/utils/requireSchoolId.js', () => ({ requireSchoolId: () => 7 }));
jest.unstable_mockModule('../marksheets/cache/marksheet-cache.service.js', () => ({
  MarksheetCacheService: class {},
}));
const { LevelService } = await import('./level.service.js');

const existing = { id: 1, class_name: 6, section: 'A', year: 2026, teacher_id: 10 };
const cache = { invalidateForClassSection: jest.fn<Fn>().mockResolvedValue(undefined) };
const service = new LevelService(cache as any);

beforeEach(() => {
  jest.clearAllMocks();
  db.levels.findUnique.mockResolvedValue(existing);
  db.levels.update.mockImplementation(async ({ data }: any) => ({ id: 1, ...data }));
  db.levels.create.mockImplementation(async ({ data }: any) => ({ id: 2, ...data }));
  db.teachers.findFirst.mockResolvedValue({ id: 11 });
});

test('addLevel refuses a teacher outside the school', async () => {
  db.teachers.findFirst.mockResolvedValue(null);
  await expect(
    service.addLevel({ class_name: 6, section: 'A', year: 2026, teacher_id: 99 } as any),
  ).rejects.toMatchObject({ statusCode: 404 });
  expect(db.teachers.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: 99, school_id: 7 } }),
  );
  expect(db.levels.create).not.toHaveBeenCalled();
});

test('updateLevel keeps missing fields and skips the teacher check when teacher_id is absent', async () => {
  const out = await service.updateLevel(1, { section: 'B' });
  expect(out).toMatchObject({ class_name: 6, section: 'B', year: 2026, teacher_id: 10 });
  expect(db.teachers.findFirst).not.toHaveBeenCalled();
  // old and new class/section both invalidated
  expect(cache.invalidateForClassSection.mock.calls).toEqual([
    [7, 6, 'A', 2026],
    [7, 6, 'B', 2026],
  ]);
});

test('updateLevel with the same slot invalidates once; checks a new teacher', async () => {
  await service.updateLevel(1, { teacher_id: 11 });
  expect(db.teachers.findFirst).toHaveBeenCalledTimes(1);
  expect(cache.invalidateForClassSection).toHaveBeenCalledTimes(1);
});

test('updateLevel: 404 for a missing level and for a foreign teacher', async () => {
  db.levels.findUnique.mockResolvedValueOnce(null);
  await expect(service.updateLevel(5, {})).rejects.toMatchObject({ statusCode: 404 });
  db.teachers.findFirst.mockResolvedValue(null);
  await expect(service.updateLevel(1, { teacher_id: 99 })).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(db.levels.update).not.toHaveBeenCalled();
});

test('a cache failure does not fail the write', async () => {
  cache.invalidateForClassSection.mockRejectedValueOnce(new Error('redis down'));
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  await expect(service.updateLevel(1, {})).resolves.toBeDefined();
});
