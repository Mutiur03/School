/**
 * Public-website PDFs (Nest REST), verified against server/src/nest/modules/{citizen-charter,
 * class-routine,syllabus} and dashboard/src/pages/Admin/{CitizenCharter,ClassRoutinePDF,Syllabus}:
 *
 *   GET  /api/citizen-charter/document             public; { file, download_url, updated_at },
 *                                                  404 when none
 *   GET  /api/citizen-charter/upload-url           admin → { uploadUrl, key }
 *   PUT  /api/citizen-charter/document { key }     admin; creates or replaces
 *
 *   GET    /api/class-routines                     public; newest first, the page shows [0]
 *   GET    /api/class-routines/upload-url          admin
 *   POST   /api/class-routines { key }             admin
 *   PATCH  /api/class-routines/:id { key }         admin; swaps the stored file
 *   DELETE /api/class-routines/:id                 admin
 *
 *   GET    /api/syllabuses                         public; every class/year for this school
 *   GET    /api/syllabuses/upload-url              admin
 *   POST   /api/syllabuses { class, year, key }    admin
 *   PATCH  /api/syllabuses/:id { class?, year?, key? }      admin; key only when replacing
 *   DELETE /api/syllabuses/:id                     admin
 *
 * Every key is presigned under this school's prefix and re-checked server-side
 * (assertTenantR2Key); no school id is ever sent.
 */
import type { ApiClient } from './client';
import { ApiError } from './errors';
import { isPdf } from './notices';
import { isObj, num, objArray, str, strOrNull, type Json } from './parse';
import { uploadViaPresign, type PickedFile } from './uploads';

export const SITE_DOC_PATHS = {
  charter: '/api/citizen-charter/document',
  charterPresign: '/api/citizen-charter/upload-url',
  routine: '/api/class-routines',
  routineOne: (id: number) => `/api/class-routines/${id}`,
  routinePresign: '/api/class-routines/upload-url',
  syllabus: '/api/syllabuses',
  syllabusUpload: '/api/syllabuses',
  syllabusOne: (id: number) => `/api/syllabuses/${id}`,
  syllabusPresign: '/api/syllabuses/upload-url',
} as const;

export interface SiteDoc {
  /** Stored key (or legacy absolute URL) to view. */
  viewKey: string;
  downloadKey: string;
  /** ISO timestamp, '' when unknown. */
  at: string;
}

export interface RoutinePdf extends SiteDoc {
  id: number;
}

export interface SyllabusRow extends SiteDoc {
  id: number;
  class: number;
  year: number;
}

const doc = (r: Json, viewField: 'file' | 'pdf_url', atField: string): SiteDoc => {
  const view = str(r[viewField]);
  return { viewKey: view, downloadKey: str(r.download_url) || view, at: str(r[atField]) };
};

export const parseCharter = (v: unknown): SiteDoc | null =>
  isObj(v) && strOrNull(v.file) ? doc(v, 'file', 'updated_at') : null;

export const parseRoutines = (v: unknown): RoutinePdf[] =>
  objArray(v, SITE_DOC_PATHS.routine)
    .filter((r) => strOrNull(r.pdf_url))
    .map((r) => ({ id: num(r.id), ...doc(r, 'pdf_url', 'created_at') }));

export const parseSyllabus = (v: unknown): SyllabusRow[] =>
  objArray(v, SITE_DOC_PATHS.syllabus)
    .filter((r) => strOrNull(r.pdf_url))
    .map((r) => ({
      id: num(r.id),
      class: num(r.class),
      year: num(r.year),
      ...doc(r, 'pdf_url', 'created_at'),
    }));

const notPdf = (path: string, what: string) =>
  new ApiError({ kind: 'config', message: `${what} must be a PDF.`, path });

export function createSiteDocsApi(client: ApiClient, fetchImpl?: typeof fetch) {
  const upload = (presign: string, file: PickedFile, what: string) => {
    if (!isPdf(file)) throw notPdf(presign, what);
    return uploadViaPresign(client, presign, { ...file, type: 'application/pdf' }, {}, fetchImpl);
  };
  return {
    async charter(signal?: AbortSignal): Promise<SiteDoc | null> {
      try {
        return parseCharter(await client.get<unknown>(SITE_DOC_PATHS.charter, { signal }));
      } catch (e) {
        // 404 = nothing uploaded yet (the web page treats it the same way).
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
    async uploadCharter(file: PickedFile): Promise<void> {
      const key = await upload(SITE_DOC_PATHS.charterPresign, file, 'Citizen charter');
      await client.put<unknown>(SITE_DOC_PATHS.charter, { key });
    },

    async routine(signal?: AbortSignal): Promise<RoutinePdf | null> {
      return (
        parseRoutines(await client.get<unknown>(SITE_DOC_PATHS.routine, { signal }))[0] ?? null
      );
    },
    /** Replaces `current` when there is one (PATCH), otherwise adds the first (POST). */
    async uploadRoutine(file: PickedFile, current: RoutinePdf | null): Promise<void> {
      const key = await upload(SITE_DOC_PATHS.routinePresign, file, 'Class routine');
      if (current) await client.patch<unknown>(SITE_DOC_PATHS.routineOne(current.id), { key });
      else await client.post<unknown>(SITE_DOC_PATHS.routine, { key });
    },
    async removeRoutine(id: number): Promise<void> {
      await client.delete<unknown>(SITE_DOC_PATHS.routineOne(id));
    },

    async syllabus(signal?: AbortSignal): Promise<SyllabusRow[]> {
      return parseSyllabus(await client.get<unknown>(SITE_DOC_PATHS.syllabus, { signal }));
    },
    async saveSyllabus(
      id: number | null,
      input: { class: number; year: number; file: PickedFile | null },
    ): Promise<void> {
      if (id === null && !input.file) {
        throw new ApiError({
          kind: 'config',
          message: 'Please select a PDF file.',
          path: SITE_DOC_PATHS.syllabusUpload,
        });
      }
      const key = input.file
        ? await upload(SITE_DOC_PATHS.syllabusPresign, input.file, 'Syllabus')
        : undefined;
      const body = { class: input.class, year: input.year, ...(key ? { key } : {}) };
      if (id === null) await client.post<unknown>(SITE_DOC_PATHS.syllabusUpload, body);
      else await client.patch<unknown>(SITE_DOC_PATHS.syllabusOne(id), body);
    },
    async removeSyllabus(id: number): Promise<void> {
      await client.delete<unknown>(SITE_DOC_PATHS.syllabusOne(id));
    },
  };
}

export type SiteDocsApi = ReturnType<typeof createSiteDocsApi>;
