/**
 * Admissions (legacy Express), verified against server/src/modules/admission/** and
 * dashboard/src/pages/Admin/{Admission,AdmissionSettings,AdmissionResult}.tsx:
 *
 *   GET    /api/admission                       public; the settings row, raw (no envelope) or null
 *   PUT    /api/admission { …settings, notice_key? }   admin; validated by admissionSettingsSchema
 *   DELETE /api/admission                       admin; removes the notice PDF
 *   POST   /api/admission/upload-url { filename, filetype }   admin → { uploadUrl, key } (PDF)
 *
 *   GET    /api/admission/form?page&limit&status&class&admission_year&search&sort&order   admin
 *          → { data: { data: rows, meta { total, pending, approved, page, limit, totalPages } } }
 *   PUT    /api/admission/form/:id/approve | /:id/pending     admin (status guard server-side)
 *   DELETE /api/admission/form/:id              admin
 *   GET    /api/admission/form/:id/pdf          PDF
 *   GET    /api/admission/form/excel?…filters   admin; .xlsx built by the server
 *   GET    /api/admission/form/images-export?…  admin; .zip of photos
 *
 *   GET    /api/admission-result                public; raw array
 *   POST   /api/admission-result/upload { files[{filename,contentType,fileSize,type}],
 *          className, admissionYear }           admin → per file: "simple" { uploadUrl, key }, or
 *          over 50 MB "multipart" { key, uploadId, chunkSize } (files up to 5 GB, the schema max)
 *   POST   /api/admission-result/multipart/sign-part { key, uploadId, partNumber }   admin; raw
 *          { success, url } (no `data`); the part is PUT there and its ETag kept
 *   POST   /api/admission-result/multipart/complete { key, uploadId, parts[{ ETag, PartNumber }] }
 *          admin; raw { success, key }. Both check the key is under this school's prefix.
 *   POST   /api/admission-result { class_name, admission_year, merit_list?, waiting_list_1?, … }
 *   PUT    /api/admission-result/:id { …same }  admin
 *   DELETE /api/admission-result/:id            admin
 */
import type { ApiClient } from './client';
import { ApiError } from './errors';
import { isPdf } from './notices';
import { isObj, num, objArray, parseError, str, strOrNull, type Json } from './parse';
import { parsePresigned, putToPresignedUrl, type PickedFile } from './uploads';

export const ADMISSION_PATHS = {
  settings: '/api/admission',
  noticeUpload: '/api/admission/upload-url',
  forms: '/api/admission/form',
  approve: (id: string) => `/api/admission/form/${encodeURIComponent(id)}/approve`,
  pending: (id: string) => `/api/admission/form/${encodeURIComponent(id)}/pending`,
  form: (id: string) => `/api/admission/form/${encodeURIComponent(id)}`,
  pdf: (id: string) => `/api/admission/form/${encodeURIComponent(id)}/pdf`,
  excel: '/api/admission/form/excel',
  photos: '/api/admission/form/images-export',
  results: '/api/admission-result',
  resultUpload: '/api/admission-result/upload',
  multipartSign: '/api/admission-result/multipart/sign-part',
  multipartComplete: '/api/admission-result/multipart/complete',
  result: (id: number) => `/api/admission-result/${id}`,
} as const;

export const ADMISSION_CLASSES = ['6', '7', '8', '9'] as const;
export type AdmissionClass = (typeof ADMISSION_CLASSES)[number];

/** Settings exactly as the form edits them (all text; the server schema coerces). */
export type PerClassField =
  `${'attachment_instruction' | 'list_type' | 'user_id' | 'serial_no'}_class${AdmissionClass}`;
export type AdmissionSettingsValues = {
  admission_year: string;
  admission_open: boolean;
  instruction: string;
  ingikar: string;
  class_list: string;
} & { [K in PerClassField]: string };

export interface AdmissionSettings {
  values: AdmissionSettingsValues;
  /** Stored notice key / URL to open, or null. */
  notice: string | null;
  year: number | null;
  open: boolean;
}

const PER_CLASS = ['attachment_instruction', 'list_type', 'user_id', 'serial_no'] as const;
const camel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

export function parseAdmissionSettings(v: unknown): AdmissionSettings | null {
  if (!isObj(v)) return null;
  const pick = (snake: string) => str(v[snake] ?? v[camel(snake)]);
  const values = {
    admission_year: v.admission_year != null && v.admission_year !== 0 ? str(v.admission_year) : '',
    admission_open: v.admission_open === true,
    instruction: str(v.instruction),
    ingikar: str(v.ingikar),
    class_list: pick('class_list'),
  } as AdmissionSettingsValues;
  for (const c of ADMISSION_CLASSES) {
    for (const f of PER_CLASS) values[`${f}_class${c}`] = pick(`${f}_class${c}`);
  }
  const noticeKey =
    strOrNull(v.notice_key) ??
    (typeof v.public_id === 'string' && !v.public_id.startsWith('http') ? v.public_id : null);
  const preview = strOrNull(v.preview_url) ?? strOrNull(v.previewUrl);
  return {
    values,
    notice: preview ?? noticeKey,
    year: num(v.admission_year) || null,
    open: v.admission_open === true,
  };
}

export type AdmissionStatus = 'pending' | 'approved';
export type AdmissionSort = 'name' | 'class' | 'userId' | 'status' | 'date';

export interface AdmissionForm {
  id: string;
  status: string;
  name: string;
  nameBn: string | null;
  cls: string;
  userId: string;
  submitted: string;
  photo: string | null;
  admissionYear: string;
  /** Every field as text, for the details view. */
  fields: Record<string, string>;
}

export interface AdmissionListParams {
  page: number;
  limit: number;
  /** Ticked statuses: one = filter, none or both = all (as on the web). */
  status: readonly AdmissionStatus[];
  cls: string;
  year: string;
  search: string;
  sort?: AdmissionSort;
  order?: 'asc' | 'desc';
}

export interface AdmissionList {
  rows: AdmissionForm[];
  meta: { total: number; pending: number; approved: number; totalPages: number };
}

const text = (v: unknown) =>
  v === null || v === undefined ? '' : typeof v === 'object' ? '' : String(v).trim();

export function parseAdmissionForm(r: Json): AdmissionForm {
  const fields = Object.fromEntries(
    Object.entries(r)
      .map(([k, v]) => [k, text(v)] as const)
      .filter(([, v]) => v !== ''),
  );
  return {
    id: str(r.id),
    status: str(r.status, 'pending'),
    name: str(r.student_name_en),
    nameBn: strOrNull(r.student_name_bn),
    cls: str(r.admission_class) || str(r.section),
    userId: str(r.admission_user_id) || str(r.roll) || str(r.serial_no),
    submitted: str(r.created_at) || str(r.submission_date),
    photo: strOrNull(r.photo_path),
    admissionYear: text(r.admission_year),
    fields,
  };
}

/** Query shared by the list and both exports (exports ignore page/limit). */
export function admissionFilterQuery(p: Omit<AdmissionListParams, 'page' | 'limit'>) {
  const q: Record<string, string> = { status: p.status.length === 1 ? p.status[0]! : 'all' };
  if (p.cls) q.class = p.cls;
  if (p.year) q.admission_year = p.year;
  if (p.search.trim()) q.search = p.search.trim();
  if (p.sort) {
    q.sort = p.sort;
    q.order = p.order ?? 'asc';
  }
  return q;
}

export function parseAdmissionList(v: unknown): AdmissionList {
  if (isObj(v) && Array.isArray(v.data)) {
    const m = isObj(v.meta) ? v.meta : {};
    return {
      rows: objArray(v.data, ADMISSION_PATHS.forms).map(parseAdmissionForm),
      meta: {
        total: num(m.total),
        pending: num(m.pending),
        approved: num(m.approved),
        totalPages: Math.max(1, num(m.totalPages, 1)),
      },
    };
  }
  if (Array.isArray(v)) {
    const rows = objArray(v, ADMISSION_PATHS.forms).map(parseAdmissionForm);
    const pending = rows.filter((r) => r.status === 'pending').length;
    return {
      rows,
      meta: { total: rows.length, pending, approved: rows.length - pending, totalPages: 1 },
    };
  }
  throw parseError(ADMISSION_PATHS.forms);
}

export type ResultListKey = 'merit_list' | 'waiting_list_1' | 'waiting_list_2';
export const RESULT_LISTS: readonly { key: ResultListKey; label: string }[] = [
  { key: 'merit_list', label: '1st Result List' },
  { key: 'waiting_list_1', label: 'Waiting List 1' },
  { key: 'waiting_list_2', label: 'Waiting List 2' },
];
/** The upload schema's limit; files over RESULT_MULTIPART_BYTES go up in parts. */
export const RESULT_MAX_BYTES = 5 * 1024 * 1024 * 1024;
export const RESULT_MULTIPART_BYTES = 50 * 1024 * 1024;
const DEFAULT_PART_BYTES = 10 * 1024 * 1024;
/** S3/R2 minimum part size (except the last part). */
const MIN_PART_BYTES = 5 * 1024 * 1024;

/** "1.2 GB" / "64 MB" for messages. */
export function formatBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(n % 1024 ** 3 === 0 ? 0 : 1)} GB`;
  return `${Math.round(n / 1024 ** 2)} MB`;
}

/** Byte ranges for each part (1-based part numbers). */
export function multipartRanges(size: number, partBytes: number) {
  const step = Math.max(MIN_PART_BYTES, partBytes || DEFAULT_PART_BYTES);
  const out: { partNumber: number; start: number; end: number }[] = [];
  for (let start = 0, n = 1; start < size; start += step, n++) {
    out.push({ partNumber: n, start, end: Math.min(start + step, size) });
  }
  return out;
}

export interface AdmissionResultRow {
  id: number;
  class_name: string;
  admission_year: number;
  merit_list: string | null;
  waiting_list_1: string | null;
  waiting_list_2: string | null;
  created_at: string;
}

export const parseAdmissionResults = (v: unknown): AdmissionResultRow[] =>
  objArray(v, ADMISSION_PATHS.results).map((r) => ({
    id: num(r.id),
    class_name: str(r.class_name),
    admission_year: num(r.admission_year),
    merit_list: strOrNull(r.merit_list),
    waiting_list_1: strOrNull(r.waiting_list_1),
    waiting_list_2: strOrNull(r.waiting_list_2),
    created_at: str(r.created_at),
  }));

export interface AdmissionResultInput {
  class_name: string;
  admission_year: number;
  files: Partial<Record<ResultListKey, PickedFile>>;
}

export function createAdmissionApi(client: ApiClient, fetchImpl?: typeof fetch) {
  const blob = (path: string, query: Record<string, string>) =>
    client.get<ArrayBuffer>(path, { query, responseType: 'arrayBuffer', timeoutMs: 300_000 });
  /** Raw `{ success, … }` replies (no `data`), read as text so the envelope unwrap keeps them. */
  const postRaw = async (path: string, payload: unknown): Promise<Record<string, unknown>> => {
    const text = await client.post<string>(path, payload, { responseType: 'text' });
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    if (!isObj(parsed) || parsed.success !== true) {
      throw new ApiError({ kind: 'parse', message: 'The upload was not accepted.', path });
    }
    return parsed;
  };
  /**
   * The web's multipart path: sign each part, PUT it, keep its ETag, then complete. The sign /
   * complete endpoints are this app's constants, never URLs from the response.
   */
  const uploadParts = async (
    item: Record<string, unknown>,
    file: PickedFile,
    onPercent: (pct: number) => void,
  ): Promise<string> => {
    const key = str(item.key);
    const uploadId = str(item.uploadId);
    if (!key || !uploadId) {
      throw new ApiError({
        kind: 'parse',
        message: `Couldn't prepare the upload for ${file.name}.`,
        path: ADMISSION_PATHS.resultUpload,
      });
    }
    const ranges = multipartRanges(file.size, num(item.chunkSize, DEFAULT_PART_BYTES));
    const parts: { ETag: string; PartNumber: number }[] = [];
    onPercent(0);
    for (const { partNumber, start, end } of ranges) {
      const signed = await postRaw(ADMISSION_PATHS.multipartSign, { key, uploadId, partNumber });
      const url = typeof signed.url === 'string' ? signed.url : '';
      if (!/^https:\/\//.test(url)) {
        throw new ApiError({
          kind: 'parse',
          message: `Couldn't sign part ${partNumber} of ${file.name}.`,
          path: ADMISSION_PATHS.multipartSign,
        });
      }
      const chunk = file.body.slice(start, end);
      const res = await putToPresignedUrl(
        url,
        { ...file, body: chunk, size: end - start },
        fetchImpl,
      );
      const etag = res.headers.get('etag')?.replace(/"/g, '');
      if (!etag) {
        throw new ApiError({
          kind: 'parse',
          message: `Missing ETag for part ${partNumber} of ${file.name}.`,
          path: ADMISSION_PATHS.multipartSign,
        });
      }
      parts.push({ ETag: etag, PartNumber: partNumber });
      onPercent(Math.round((partNumber / ranges.length) * 100));
    }
    await postRaw(ADMISSION_PATHS.multipartComplete, { key, uploadId, parts });
    return key;
  };
  return {
    async settings(signal?: AbortSignal): Promise<AdmissionSettings | null> {
      return parseAdmissionSettings(
        await client.get<unknown>(ADMISSION_PATHS.settings, { signal }),
      );
    },
    /** Uploads a new notice first (if picked), then saves; the stored key is never echoed back. */
    async saveSettings(values: Record<string, unknown>, notice: PickedFile | null): Promise<void> {
      let notice_key: string | undefined;
      if (notice) {
        if (!isPdf(notice)) {
          throw new ApiError({
            kind: 'config',
            message: 'Only PDF files are allowed',
            path: ADMISSION_PATHS.noticeUpload,
          });
        }
        const data = await client.post<unknown>(ADMISSION_PATHS.noticeUpload, {
          filename: notice.name,
          filetype: 'application/pdf',
        });
        const p = parsePresigned(data, ADMISSION_PATHS.noticeUpload);
        await putToPresignedUrl(p.uploadUrl, { ...notice, type: 'application/pdf' }, fetchImpl);
        notice_key = p.key;
      }
      const { notice_key: _drop, ...rest } = values;
      await client.put<unknown>(ADMISSION_PATHS.settings, {
        ...rest,
        ...(notice_key ? { notice_key } : {}),
      });
    },
    async removeNotice(): Promise<void> {
      await client.delete<unknown>(ADMISSION_PATHS.settings);
    },

    async forms(p: AdmissionListParams, signal?: AbortSignal): Promise<AdmissionList> {
      return parseAdmissionList(
        await client.get<unknown>(ADMISSION_PATHS.forms, {
          query: { page: p.page, limit: p.limit, ...admissionFilterQuery(p) },
          signal,
        }),
      );
    },
    async setStatus(id: string, status: AdmissionStatus): Promise<void> {
      await client.put<unknown>(
        status === 'approved' ? ADMISSION_PATHS.approve(id) : ADMISSION_PATHS.pending(id),
        {},
      );
    },
    async removeForm(id: string): Promise<void> {
      await client.delete<unknown>(ADMISSION_PATHS.form(id));
    },
    pdf(id: string): Promise<ArrayBuffer> {
      return client.get<ArrayBuffer>(ADMISSION_PATHS.pdf(id), {
        responseType: 'arrayBuffer',
        timeoutMs: 120_000,
      });
    },
    exportExcel: (filters: Omit<AdmissionListParams, 'page' | 'limit'>) =>
      blob(ADMISSION_PATHS.excel, admissionFilterQuery(filters)),
    exportPhotos: (filters: Omit<AdmissionListParams, 'page' | 'limit'>) =>
      blob(ADMISSION_PATHS.photos, admissionFilterQuery(filters)),

    async results(signal?: AbortSignal): Promise<AdmissionResultRow[]> {
      return parseAdmissionResults(await client.get<unknown>(ADMISSION_PATHS.results, { signal }));
    },
    /** Uploads the picked PDFs, then creates (id null) or updates the result row. */
    async saveResult(
      id: number | null,
      input: AdmissionResultInput,
      onProgress?: (label: string) => void,
    ): Promise<void> {
      const picked = RESULT_LISTS.flatMap(({ key }) => {
        const f = input.files[key];
        return f ? [{ key, file: f }] : [];
      });
      for (const { file } of picked) {
        if (!isPdf(file)) {
          throw new ApiError({
            kind: 'config',
            message: 'Please upload only PDF files',
            path: ADMISSION_PATHS.resultUpload,
          });
        }
        if (file.size > RESULT_MAX_BYTES) {
          throw new ApiError({
            kind: 'config',
            message: `${file.name} is larger than ${formatBytes(RESULT_MAX_BYTES)}`,
            path: ADMISSION_PATHS.resultUpload,
          });
        }
      }
      if (id === null && picked.length === 0) {
        throw new ApiError({
          kind: 'config',
          message: 'Please upload at least one PDF file',
          path: ADMISSION_PATHS.results,
        });
      }
      const body: Record<string, unknown> = {
        class_name: input.class_name,
        admission_year: input.admission_year,
      };
      if (picked.length) {
        const data = await client.post<unknown>(ADMISSION_PATHS.resultUpload, {
          files: picked.map(({ key, file }) => ({
            filename: file.name,
            contentType: 'application/pdf',
            fileSize: file.size,
            type: key,
          })),
          className: input.class_name,
          admissionYear: input.admission_year,
        });
        const items = objArray(data, ADMISSION_PATHS.resultUpload);
        for (const { key, file } of picked) {
          const item = items.find((i) => i.type === key);
          if (
            !item ||
            item.success !== true ||
            (item.mode !== 'simple' && item.mode !== 'multipart')
          ) {
            throw new ApiError({
              kind: 'parse',
              message: `Couldn't prepare the upload for ${file.name}.`,
              path: ADMISSION_PATHS.resultUpload,
            });
          }
          if (item.mode === 'multipart') {
            body[key] = await uploadParts(item, { ...file, type: 'application/pdf' }, (pct) =>
              onProgress?.(`Uploading ${file.name}: ${pct}%`),
            );
            continue;
          }
          onProgress?.(`Uploading ${file.name}…`);
          const p = parsePresigned(item, ADMISSION_PATHS.resultUpload);
          await putToPresignedUrl(p.uploadUrl, { ...file, type: 'application/pdf' }, fetchImpl);
          body[key] = p.key;
        }
      }
      onProgress?.('Saving changes…');
      if (id === null) await client.post<unknown>(ADMISSION_PATHS.results, body);
      else await client.put<unknown>(ADMISSION_PATHS.result(id), body);
    },
    async removeResult(id: number): Promise<void> {
      await client.delete<unknown>(ADMISSION_PATHS.result(id));
    },
  };
}

export type AdmissionApi = ReturnType<typeof createAdmissionApi>;
