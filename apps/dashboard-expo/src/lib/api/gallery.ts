/**
 * Gallery (Nest REST), verified against server/src/nest/modules/gallery/gallery.controller.ts and
 * dashboard/src/pages/Admin/{Gallery,GalleryModeration}.tsx:
 *
 *   GET    /api/gallery                          approved photos → { events: {title: img[]},
 *                                                categories: {title: img[]} }
 *   GET    /api/gallery/images?status=pending|rejected   admin; same shape
 *   GET    /api/gallery/categories               [{ id, category, thumbnail }]
 *   GET    /api/gallery/upload-url?filename&contentType   → { uploadUrl, key }
 *   POST   /api/gallery/images { keys, caption?, eventId? | categoryId? }  status set by the
 *                                                server (admin → approved, others → pending)
 *   PATCH  /api/gallery/images/:id { imageKey?, caption?, eventId? | categoryId? }   admin
 *   PATCH  /api/gallery/images/:id/status { status: approved|rejected }   admin
 *   PATCH  /api/gallery/images { ids, status: 'rejected' }               admin (bulk)
 *   DELETE /api/gallery/images { ids }  |  DELETE /api/gallery/images/:id  admin
 *   PUT    /api/gallery/events/:id/thumbnail | /categories/:id/thumbnail { imageId }
 *
 * A photo belongs to an event or to a category, never both.
 */
import type { ApiClient } from './client';
import { ApiError } from './errors';
import { isObj, num, numOrNull, objArray, parseError, str, strOrNull } from './parse';
import { uploadViaPresign, type PickedFile } from './uploads';

export const GALLERY_PATHS = {
  approved: '/api/gallery',
  categories: '/api/gallery/categories',
  presign: '/api/gallery/upload-url',
  upload: '/api/gallery/images',
  images: '/api/gallery/images',
  update: (id: number) => `/api/gallery/images/${id}`,
  status: (id: number) => `/api/gallery/images/${id}/status`,
  remove: (id: number) => `/api/gallery/images/${id}`,
  eventThumb: (eventId: number) => `/api/gallery/events/${eventId}/thumbnail`,
  categoryThumb: (categoryId: number) => `/api/gallery/categories/${categoryId}/thumbnail`,
} as const;

/** The built-in "Events" category id (picking it in the form means "choose an event"). */
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
  /** Category id as text; ignored when an event is set. */
  categoryId: string;
}

/** Client-side checks mirroring the web form; returns an error message or null. */
export function placementError(p: GalleryPlacement): string | null {
  if (!p.eventId && !p.categoryId) return 'Please select either a category or an event';
  if (!p.eventId && p.categoryId === EVENTS_CATEGORY_ID) return 'Select the event for this photo';
  return null;
}

/** `{ eventId }` or `{ categoryId }` (numbers), never both. */
export const placementBody = (p: GalleryPlacement): { eventId: number } | { categoryId: number } =>
  p.eventId ? { eventId: Number(p.eventId) } : { categoryId: Number(p.categoryId) };

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
      // Approved photos are public; the moderation queues are `images?status=` (admin).
      const path = status === 'approved' ? GALLERY_PATHS.approved : GALLERY_PATHS.images;
      const query = status === 'approved' ? undefined : { status };
      return parseGalleryGroups(await client.get<unknown>(path, { query, signal }), path);
    },
    async categories(signal?: AbortSignal): Promise<GalleryCategory[]> {
      return parseGalleryCategories(
        await client.get<unknown>(GALLERY_PATHS.categories, { signal }),
      );
    },
    /** Uploads each image, then files them (the server approves admin uploads). */
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
      });
      return keys.length;
    },
    async update(id: number, caption: string, p: GalleryPlacement, file: PickedFile | null) {
      const bad = placementError(p) ?? (file ? imageFileError(file) : null);
      if (bad) throw invalid(bad, GALLERY_PATHS.update(id));
      const imageKey = file
        ? await uploadViaPresign(client, GALLERY_PATHS.presign, file, {}, fetchImpl)
        : undefined;
      await client.patch<unknown>(GALLERY_PATHS.update(id), {
        ...(imageKey ? { imageKey } : {}),
        caption: caption.trim(),
        ...placementBody(p),
      });
    },
    async approve(list: readonly number[]): Promise<void> {
      for (const id of list) {
        await client.patch<unknown>(GALLERY_PATHS.status(id), { status: 'approved' });
      }
    },
    async reject(list: readonly number[]): Promise<void> {
      if (list.length) {
        await client.patch<unknown>(GALLERY_PATHS.images, { ...ids(list), status: 'rejected' });
      }
    },
    async remove(list: readonly number[]): Promise<void> {
      if (list.length === 1) await client.delete<unknown>(GALLERY_PATHS.remove(list[0]!));
      else if (list.length) {
        await client.request<unknown>(GALLERY_PATHS.images, { method: 'DELETE', body: ids(list) });
      }
    },
    async setThumbnail(group: GalleryGroup, imageId: number): Promise<void> {
      if (group.refId == null) throw invalid('This album has no id', GALLERY_PATHS.approved);
      await client.put<unknown>(
        group.kind === 'event'
          ? GALLERY_PATHS.eventThumb(group.refId)
          : GALLERY_PATHS.categoryThumb(group.refId),
        { imageId },
      );
    },
  };
}

export type GalleryApi = ReturnType<typeof createGalleryApi>;
