import { jest } from '@jest/globals';

type Fn = (...args: any[]) => Promise<any>;
const db: any = {
  staffs: { count: jest.fn<Fn>(), findMany: jest.fn<Fn>(), createMany: jest.fn<Fn>() },
  $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
};
jest.unstable_mockModule('@/config/prisma.js', () => ({ prisma: db }));
jest.unstable_mockModule('@/config/r2.js', () => ({ getUploadUrl: async () => 'u' }));
jest.unstable_mockModule('@/utils/r2Key.util.js', () => ({
  assertTenantR2KeyIfPresent: () => undefined,
  deleteFromR2IfPresent: async () => undefined,
  tenantR2Key: (k: string) => k,
}));
jest.unstable_mockModule('@/utils/requireSchoolId.js', () => ({ requireSchoolId: () => 7 }));
const { StaffService } = await import('./staff.service.js');
const service = new StaffService();

beforeEach(() => {
  jest.clearAllMocks();
  db.staffs.count.mockResolvedValue(45);
  db.staffs.findMany.mockResolvedValue([]);
});

test.each([
  [{ page: 0, limit: 0 }, { page: 1, limit: 20, totalPages: 3 }, 0],
  [{ page: 2.7, limit: 10 }, { page: 2, limit: 10, totalPages: 5 }, 10],
  [{ page: 1, limit: 999 }, { page: 1, limit: 200, totalPages: 1 }, 0],
  [{ page: NaN, limit: NaN }, { page: 1, limit: 20, totalPages: 3 }, 0],
])('pagination %j', async (input, meta, skip) => {
  const out = await service.getStaffsPaginated(input);
  expect(out.meta).toMatchObject({ total: 45, ...meta });
  expect(db.staffs.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ skip, take: meta.limit }),
  );
});

test('search is scoped to the school and trimmed', async () => {
  await service.getStaffsPaginated({ page: 1, limit: 10, search: '  rahim ' });
  const where = db.staffs.count.mock.calls[0][0].where;
  expect(where.school_id).toBe(7);
  expect(where.OR[0]).toEqual({ name: { contains: 'rahim', mode: 'insensitive' } });
});

test('zero rows → zero pages', async () => {
  db.staffs.count.mockResolvedValue(0);
  expect((await service.getStaffsPaginated({ page: 1, limit: 10 })).meta.totalPages).toBe(0);
});

test('addStaff: duplicate email is 409 and nothing is written', async () => {
  db.staffs.findMany.mockResolvedValue([{ email: 'a@x.test' }]);
  await expect(service.addStaff([{ name: 'A', email: 'a@x.test' } as any])).rejects.toMatchObject({
    statusCode: 409,
  });
  expect(db.staffs.createMany).not.toHaveBeenCalled();
});
