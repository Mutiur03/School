/**
 * Gallery (legacy Express), verified against server/src/modules/gallery/** and
 * dashboard/src/pages/Admin/{Gallery,GalleryModeration}.tsx:
 *
 *   GET    /api/gallery/getGalleries             approved photos → { events: {title: img[]},
 *                                                categories: {title: img[]} } (raw, no envelope)
 *   GET    /api/gallery/pending | /rejected      admin; same shape
 *   GET    /api/gallery/getCategories            [{ id, category, thumbnail }]
 *   GET    /api/gallery/presigned-url?filename&contentType   → { uploadUrl, key }
 *   POST   /api/gallery/upload { keys, caption, eventId, category, status: 'approved' }
 *   PUT    /api/gallery/updateGallery/:id { imageKey?, caption, eventId, category }   admin
 *   PATCH  /api/gallery/approve/:id | /reject/:id               admin
 *   POST   /api/gallery/rejectMultiple | /deleteMultiple { ids }   admin
 *   DELETE /api/gallery/deleteGallery/:id                        admin
 *   PUT    /api/gallery/setEventThumbnail/:event/:image | /setCategoryThumbnail/:cat/:image
 *
 * Photos tied to an event are stored under category "1" (the events category), as on the web.
 */
import type { ApiClient } from './client';
import { ApiError } from './errors';
import { isObj, num, numOrNull, objArray, parseError, str, strOrNull } from './parse';
import { uploadViaPresign, type PickedFile } from './uploads';

export const GALLERY_PATHS = {
  approved: '/api/gallery/getGalleries',
  pending: '/api/gallery/pending',
  rejected: '/api/gallery/rejected',
  categories: '/api/gallery/getCategories',
  presign: '/api/gallery/presigned-url',
  upload: '/api/gallery/upload',
  update: (id: number) => `/api/gallery/updateGallery/${id}`,
  approve: (id: number) => `/api/gallery/approve/${id}`,
  reject: (id: number) => `/api/gallery/reject/${id}`,
  rejectMany: '/api/gallery/rejectMultiple',
  remove: (id: number) => `/api/gallery/deleteGallery/${id}`,
  removeMany: '/api/gallery/deleteMultiple',
  eventThumb: (eventId: number, imageId: number) =>
    `/api/gallery/setEventThumbnail/${eventId}/${imageId}`,
  categoryThumb: (categoryId: number, imageId: number) =>
    `/api/gallery/setCategoryThumbnail/${categoryId}/${imageId}`,
} as const;

/** The built-in "Events" category id; event photos are filed under it. */
export const EVENTS_CATEGORY_ID = '1';
export const GALLERY_MAX_BYTES = 5 * 1024 * 1024;

export type GalleryStatus = 'approved' | 'pending' | 'rejected';

export interface GalleryImage {
  id: number;
  key: string;
  caption: string;
  eventId: number | null;
  categoryId: number | null;
  category: string | null;
  createdAt: string;
  studentName: string | null;
  studentBatch: string | null;
}

export interface GalleryGroup {
  /** Stable id: "event:<title>" or "category:<title>". */
  id: string;
  kind: 'event' | 'category';
  title: string;
  /** Event or category id, read from the photos (for thumbnails). */
  refId: number | null;
  images: GalleryImage[];
}

export interface GalleryCategory {
  id: number;
  name: string;
}

function parseImage(r: Record<string, unknown>): GalleryImage {
  return {
    id: num(r.id),
    key: str(r.image_path),
    caption: str(r.caption),
    eventId: numOrNull(r.event_id),
    categoryId: numOrNull(r.category_id),
    category: strOrNull(r.category),
    createdAt: str(r.created_at),
    studentName: strOrNull(r.student_name),
    studentBatch: r.student_batch == null ? null : str(r.student_batch),
  };
}

/** Events first, then categories; each group's photos newest first. */
export function parseGalleryGroups(v: unknown, path: string): GalleryGroup[] {
  if (!isObj(v)) throw parseError(path);
  const groups: GalleryGroup[] = [];
  for (const kind of ['event', 'category'] as const) {
    const bucket = v[kind === 'event' ? 'events' : 'categories'];
    if (!isObj(bucket)) continue;
    for (const [title, list] of Object.entries(bucket)) {
      const images = objArray(list, path)
        .map(parseImage)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
      if (!images.length) continue;
      const first = images[0]!;
      groups.push({
        id: `${kind}:${title}`,
        kind,
        title,
        refId: kind === 'event' ? first.eventId : first.categoryId,
        images,
      });
    }
  }
  return groups;
}

export const parseGalleryCategories = (v: unknown): GalleryCategory[] =>
  objArray(v, GALLERY_PATHS.categories)
    .map((r) => ({ id: num(r.id), name: str(r.category) }))
    .filter((c) => c.id > 0);

/** "Name (Batch X)" for student uploads, otherwise "Admin" (as on the web). */
export const uploader = (img: GalleryImage) =>
  img.studentName
    ? `${img.studentName}${img.studentBatch ? ` (Batch ${img.studentBatch})` : ''}`
    : 'Admin';

export interface GalleryPlacement {
  /** Event id as text, or '' for none. */
  eventId: string;
  /** Category id as text; ignored (forced to the events category) when an event is set. */
  categoryId: string;
}

/** Client-side checks mirroring the web form; returns an error message or null. */
export function placementError(p: GalleryPlacement): string | null {
  if (!p.eventId && !p.categoryId) return 'Please select either a category or an event';
  if (!p.eventId && p.categoryId === EVENTS_CATEGORY_ID) return 'Select the event for this photo';
  return null;
}

export const placementBody = (p: GalleryPlacement) => ({
  eventId: p.eventId,
  category: p.eventId ? EVENTS_CATEGORY_ID : p.categoryId,
});

export function imageFileError(f: PickedFile): string | null {
  if (!f.type.startsWith('image/')) return `${f.name} is not an image`;
  if (f.size > GALLERY_MAX_BYTES) return `${f.name} is larger than 5 MB`;
  return null;
}

const invalid = (message: string, path: string) => new ApiError({ kind: 'config', message, path });

export function createGalleryApi(client: ApiClient, fetchImpl?: typeof fetch) {
  const ids = (list: readonly number[]) => ({ ids: [...list] });
  return {
    async list(status: GalleryStatus, signal?: AbortSignal): Promise<GalleryGroup[]> {
      const path = GALLERY_PATHS[status];
      return parseGalleryGroups(await client.get<unknown>(path, { signal }), path);
    },
    async categories(signal?: AbortSignal): Promise<GalleryCategory[]> {
      return parseGalleryCategories(
        await client.get<unknown>(GALLERY_PATHS.categories, { signal }),
      );
    },
    /** Uploads each image, then files them all as approved (admin uploads skip review). */
    async upload(files: readonly PickedFile[], caption: string, p: GalleryPlacement) {
      if (!files.length) throw invalid('Please select at least one image', GALLERY_PATHS.upload);
      const bad = placementError(p) ?? files.map(imageFileError).find(Boolean) ?? null;
      if (bad) throw invalid(bad, GALLERY_PATHS.upload);
      const keys: string[] = [];
      for (const f of files) {
        keys.push(await uploadViaPresign(client, GALLERY_PATHS.presign, f, {}, fetchImpl));
      }
      await client.post<unknown>(GALLERY_PATHS.upload, {
        keys,
        caption: caption.trim(),
        ...placementBody(p),
        status: 'approved',
      });
      return keys.length;
    },
    async update(id: number, caption: string, p: GalleryPlacement, file: PickedFile | null) {
      const bad = placementError(p) ?? (file ? imageFileError(file) : null);
      if (bad) throw invalid(bad, GALLERY_PATHS.update(id));
      const imageKey = file
        ? await uploadViaPresign(client, GALLERY_PATHS.presign, file, {}, fetchImpl)
        : undefined;
      await client.put<unknown>(GALLERY_PATHS.update(id), {
        ...(imageKey ? { imageKey } : {}),
        caption: caption.trim(),
        ...placementBody(p),
      });
    },
    async approve(list: readonly number[]): Promise<void> {
      for (const id of list) await client.patch<unknown>(GALLERY_PATHS.approve(id), {});
    },
    async reject(list: readonly number[]): Promise<void> {
      if (list.length === 1) await client.patch<unknown>(GALLERY_PATHS.reject(list[0]!), {});
      else if (list.length) await client.post<unknown>(GALLERY_PATHS.rejectMany, ids(list));
    },
    async remove(list: readonly number[]): Promise<void> {
      if (list.length === 1) await client.delete<unknown>(GALLERY_PATHS.remove(list[0]!));
      else if (list.length) await client.post<unknown>(GALLERY_PATHS.removeMany, ids(list));
    },
    async setThumbnail(group: GalleryGroup, imageId: number): Promise<void> {
      if (group.refId == null) throw invalid('This album has no id', GALLERY_PATHS.approved);
      await client.put<unknown>(
        group.kind === 'event'
          ? GALLERY_PATHS.eventThumb(group.refId, imageId)
          : GALLERY_PATHS.categoryThumb(group.refId, imageId),
        {},
      );
    },
  };
}

export type GalleryApi = ReturnType<typeof createGalleryApi>;
