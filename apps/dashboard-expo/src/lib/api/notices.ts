/**
 * Admin notices (legacy Express), verified against server/src/modules/notice/ and
 * dashboard/src/queries/notice.queries.ts + pages/Admin/Notice.tsx:
 *
 *   GET    /api/notices/getNotices                public, school from host, newest first
 *   GET    /api/notices/presigned-url?filename&contentType   admin → { uploadUrl, key }
 *   POST   /api/notices/addNotice { title, key, created_at? }    admin; key required (a PDF)
 *   PUT    /api/notices/updateNotice/:id { title?, key?, created_at? }   admin
 *   DELETE /api/notices/deleteNotice/:id          admin; also removes the PDF from storage
 */
import type { ApiClient } from './client';
import { ApiError } from './errors';
import { parseNotices, type Notice } from './student-portal';
import { uploadViaPresign, type PickedFile } from './uploads';

export const NOTICE_PATHS = {
  list: '/api/notices/getNotices',
  presign: '/api/notices/presigned-url',
  add: '/api/notices/addNotice',
  update: (id: number) => `/api/notices/updateNotice/${id}`,
  remove: (id: number) => `/api/notices/deleteNotice/${id}`,
} as const;

export interface NoticeInput {
  title: string;
  /** `YYYY-MM-DD`; '' = today (create) / keep (edit). */
  created_at: string;
  /** New PDF. Required to create; optional on edit (keeps the current file). */
  file: PickedFile | null;
}

export const isPdf = (f: Pick<PickedFile, 'name' | 'type'>) =>
  f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

export function createNoticesApi(client: ApiClient, fetchImpl?: typeof fetch) {
  const upload = async (file: PickedFile) => {
    if (!isPdf(file)) {
      throw new ApiError({
        kind: 'config',
        message: 'Notice must be a PDF.',
        path: NOTICE_PATHS.presign,
      });
    }
    return uploadViaPresign(
      client,
      NOTICE_PATHS.presign,
      { ...file, type: 'application/pdf' },
      {},
      fetchImpl,
    );
  };
  return {
    async list(signal?: AbortSignal): Promise<Notice[]> {
      return parseNotices(await client.get<unknown>(NOTICE_PATHS.list, { signal }));
    },
    async create(input: NoticeInput): Promise<void> {
      if (!input.file) {
        throw new ApiError({
          kind: 'config',
          message: 'Choose a PDF to publish.',
          path: NOTICE_PATHS.add,
        });
      }
      const key = await upload(input.file);
      await client.post<unknown>(NOTICE_PATHS.add, {
        title: input.title.trim(),
        key,
        ...(input.created_at ? { created_at: input.created_at } : {}),
      });
    },
    async update(id: number, input: NoticeInput): Promise<void> {
      const key = input.file ? await upload(input.file) : undefined;
      await client.put<unknown>(NOTICE_PATHS.update(id), {
        title: input.title.trim(),
        ...(key ? { key } : {}),
        ...(input.created_at ? { created_at: input.created_at } : {}),
      });
    },
    async remove(id: number): Promise<void> {
      await client.delete<unknown>(NOTICE_PATHS.remove(id));
    },
  };
}

export type NoticesApi = ReturnType<typeof createNoticesApi>;
