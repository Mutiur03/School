/**
 * Events (Nest REST), verified against server/src/nest/modules/events/ and
 * dashboard/src/queries/events.queries.ts:
 *
 *   GET    /api/events                               public, school from host
 *   GET    /api/events/upload-url?filename&contentType&type=image|file   admin
 *   POST   /api/events { title, date, details?, location?, imageKey?, fileKey? }  admin
 *   PATCH  /api/events/:id  same body, keys only when replaced            admin
 *   DELETE /api/events/:id  admin; removes the stored image/file
 */
import type { ApiClient } from './client';
import { num, objArray, str, strOrNull } from './parse';
import { uploadViaPresign, type PickedFile } from './uploads';

export interface SchoolEvent {
  id: number;
  title: string;
  details: string;
  location: string;
  /** `YYYY-MM-DD` (stored as a 10-char string). */
  date: string;
  image: string | null;
  file: string | null;
}

export interface EventInput {
  title: string;
  date: string;
  details: string;
  location: string;
  image: PickedFile | null;
  file: PickedFile | null;
}

export const EVENT_PATHS = {
  list: '/api/events',
  presign: '/api/events/upload-url',
  add: '/api/events',
  update: (id: number) => `/api/events/${id}`,
  remove: (id: number) => `/api/events/${id}`,
} as const;

export function parseEvents(v: unknown): SchoolEvent[] {
  return objArray(v, EVENT_PATHS.list).map((e) => ({
    id: num(e.id),
    title: str(e.title),
    details: str(e.details),
    location: str(e.location),
    date: str(e.date).slice(0, 10),
    image: strOrNull(e.image),
    file: strOrNull(e.file),
  }));
}

export function createEventsApi(client: ApiClient, fetchImpl?: typeof fetch) {
  const keys = async (input: EventInput) => ({
    imageKey: input.image
      ? await uploadViaPresign(
          client,
          EVENT_PATHS.presign,
          input.image,
          { type: 'image' },
          fetchImpl,
        )
      : undefined,
    fileKey: input.file
      ? await uploadViaPresign(client, EVENT_PATHS.presign, input.file, { type: 'file' }, fetchImpl)
      : undefined,
  });
  const body = (input: EventInput, k: { imageKey?: string; fileKey?: string }) => ({
    title: input.title.trim(),
    date: input.date,
    details: input.details.trim(),
    location: input.location.trim(),
    ...(k.imageKey ? { imageKey: k.imageKey } : {}),
    ...(k.fileKey ? { fileKey: k.fileKey } : {}),
  });
  return {
    async list(signal?: AbortSignal): Promise<SchoolEvent[]> {
      return parseEvents(await client.get<unknown>(EVENT_PATHS.list, { signal }));
    },
    async create(input: EventInput): Promise<void> {
      await client.post<unknown>(EVENT_PATHS.add, body(input, await keys(input)));
    },
    async update(id: number, input: EventInput): Promise<void> {
      await client.patch<unknown>(EVENT_PATHS.update(id), body(input, await keys(input)));
    },
    async remove(id: number): Promise<void> {
      await client.delete<unknown>(EVENT_PATHS.remove(id));
    },
  };
}

export type EventsApi = ReturnType<typeof createEventsApi>;
