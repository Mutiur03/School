import { jest } from '@jest/globals';

type Fn = (...args: any[]) => Promise<any>;
const m = () => ({ findFirst: jest.fn<Fn>(), createMany: jest.fn<Fn>(), update: jest.fn<Fn>() });
const db: any = { gallery: m(), events: m(), categories: m() };
jest.unstable_mockModule('@/config/prisma.js', () => ({ prisma: db }));
jest.unstable_mockModule('@/config/r2.js', () => ({ getUploadUrl: async () => 'u' }));
jest.unstable_mockModule('@/utils/r2Key.util.js', () => ({
  assertTenantR2Keys: () => undefined,
  assertTenantR2Key: () => undefined,
  deleteFromR2IfPresent: jest.fn<Fn>().mockResolvedValue(undefined),
  tenantR2Key: (k: string) => `7/${k}`,
}));
const { GalleryService, uploadStatusFor } = await import('./gallery.service.js');
const service = new GalleryService();

beforeEach(() => {
  jest.clearAllMocks();
  db.events.findFirst.mockResolvedValue({ id: 3 });
  db.categories.findFirst.mockResolvedValue({ id: 4 });
  db.gallery.findFirst.mockResolvedValue({
    id: 1,
    image_path: '7/a.jpg',
    caption: 'c',
    event_id: 3,
    category_id: 4,
  });
  db.gallery.update.mockImplementation(async ({ data }: any) => data);
});

test.each([
  ['admin', 'approved'],
  ['teacher', 'pending'],
  ['student', 'pending'],
  ['super_admin', 'pending'],
])('uploadStatusFor(%s) = %s', (role, status) => expect(uploadStatusFor(role)).toBe(status));

test('addGallery checks event and category against the school', async () => {
  db.events.findFirst.mockResolvedValue(null);
  await expect(
    service.addGallery({ keys: ['7/a'], eventId: 9 }, 1, 'admin', 7),
  ).rejects.toMatchObject({ statusCode: 404 });
  expect(db.events.findFirst).toHaveBeenCalledWith({ where: { id: 9, school_id: 7 } });
  db.events.findFirst.mockResolvedValue({ id: 9 });
  db.categories.findFirst.mockResolvedValue(null);
  await expect(
    service.addGallery({ keys: ['7/a'], eventId: 9, category: 8 }, 1, 'admin', 7),
  ).rejects.toMatchObject({ statusCode: 404 });
  expect(db.gallery.createMany).not.toHaveBeenCalled();
});

test('addGallery: student uploader id kept, status passed through, empty keys 400', async () => {
  await service.addGallery({ keys: ['7/a', '7/b'], status: 'pending' }, 5, 'student', 7);
  const rows = db.gallery.createMany.mock.calls[0][0].data;
  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({
    uploader_id: 5,
    status: 'pending',
    school_id: 7,
    event_id: null,
  });
  await expect(service.addGallery({ keys: [] }, 5, 'student', 7)).rejects.toMatchObject({
    statusCode: 400,
  });
});

test('updateGallery is a real PATCH: missing fields are kept, "" clears a link', async () => {
  expect(await service.updateGallery(1, { caption: 'new' }, 7)).toEqual({ caption: 'new' });
  expect(await service.updateGallery(1, { eventId: '' }, 7)).toEqual({ event_id: null });
  db.categories.findFirst.mockResolvedValue(null);
  await expect(service.updateGallery(1, { category: 8 }, 7)).rejects.toMatchObject({
    statusCode: 404,
  });
});

test('thumbnails refuse an event/category of another school', async () => {
  db.categories.findFirst.mockResolvedValue(null);
  await expect(service.setCategoryThumbnail(8, 1, 7)).rejects.toMatchObject({ statusCode: 404 });
  db.events.findFirst.mockResolvedValue(null);
  await expect(service.setEventThumbnail(9, 1, 7)).rejects.toMatchObject({ statusCode: 404 });
});
