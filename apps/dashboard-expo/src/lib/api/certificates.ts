/**
 * Certificates (Nest, admin only), verified against
 * server/src/nest/modules/certificate/certificate-admin.controller.ts and
 * dashboard/src/queries/certificates.queries.ts. The school comes from the session (@SchoolId):
 *
 *   GET    /api/admin/certificates?page&limit&sort&order&name&mobile&exam&year&edits&status
 *          → { items, meta { total, page, limit, totalPages, totalAll, editedCount,
 *              pendingCount, exams[], years[] } }      exam / year are comma lists
 *   GET    /api/admin/certificates/:id/revisions → [{ id, created_at, changes[{field,from,to}] }]
 *   PATCH  /api/admin/certificates/:id/status { status: 'pending' | 'approved' }
 *   GET    /api/admin/certificates/:id/pdf?address=false   PDF (with the address unless false)
 *   DELETE /api/admin/certificates/:id
 *
 * ids are UUIDs (ParseUUIDPipe); they are path-encoded anyway.
 */
import type { ApiClient } from './client';
import { isObj, num, objArray, parseError, str, type Json } from './parse';

export const CERT_PATHS = {
  list: '/api/admin/certificates',
  revisions: (id: string) => `/api/admin/certificates/${encodeURIComponent(id)}/revisions`,
  status: (id: string) => `/api/admin/certificates/${encodeURIComponent(id)}/status`,
  pdf: (id: string) => `/api/admin/certificates/${encodeURIComponent(id)}/pdf`,
  one: (id: string) => `/api/admin/certificates/${encodeURIComponent(id)}`,
} as const;

export type CertificateStatus = 'pending' | 'approved';
export type CertificateSort = 'name' | 'exam' | 'year' | 'mobile' | 'updated' | 'edits';

export interface CertificateRecord {
  id: string;
  status: CertificateStatus;
  data: Record<string, string>;
  created_at: string;
  updated_at: string;
  edits: number;
}

export interface CertificateRevision {
  id: number;
  created_at: string;
  changes: { field: string; from: string | null; to: string | null }[];
}

export interface CertificateParams {
  page: number;
  limit: number;
  sort?: CertificateSort;
  order?: 'asc' | 'desc';
  name?: string;
  mobile?: string;
  exam?: readonly string[];
  year?: readonly string[];
  /** Ticked edit / status boxes: one = filter, none or both = no filter (as on the web). */
  edits?: readonly ('edited' | 'never')[];
  status?: readonly CertificateStatus[];
}

export interface CertificateList {
  items: CertificateRecord[];
  meta: {
    total: number;
    page: number;
    totalPages: number;
    totalAll: number;
    editedCount: number;
    pendingCount: number;
    exams: string[];
    years: number[];
  };
}

const cell = (v: unknown): string | null =>
  v === null || v === undefined ? null : typeof v === 'object' ? JSON.stringify(v) : String(v);

export function certificateQuery(p: CertificateParams): Record<string, string | number> {
  const q: Record<string, string | number> = { page: p.page, limit: p.limit };
  if (p.sort) q.sort = p.sort;
  if (p.sort && p.order) q.order = p.order;
  if (p.name?.trim()) q.name = p.name.trim();
  if (p.mobile?.trim()) q.mobile = p.mobile.trim();
  if (p.exam?.length) q.exam = p.exam.join(',');
  if (p.year?.length) q.year = p.year.join(',');
  if (p.edits?.length === 1) q.edits = p.edits[0]!;
  if (p.status?.length === 1) q.status = p.status[0]!;
  return q;
}

const parseRecord = (r: Json): CertificateRecord => ({
  id: str(r.id),
  status: r.status === 'approved' ? 'approved' : 'pending',
  data: isObj(r.data)
    ? Object.fromEntries(
        Object.entries(r.data)
          .map(([k, v]) => [k, cell(v)] as const)
          .filter((e): e is readonly [string, string] => e[1] !== null),
      )
    : {},
  created_at: str(r.created_at),
  updated_at: str(r.updated_at),
  edits: num(r.edits),
});

export function parseCertificateList(v: unknown): CertificateList {
  if (!isObj(v) || !Array.isArray(v.items)) throw parseError(CERT_PATHS.list);
  const m = isObj(v.meta) ? v.meta : {};
  return {
    items: objArray(v.items, CERT_PATHS.list).map(parseRecord),
    meta: {
      total: num(m.total),
      page: num(m.page, 1),
      totalPages: Math.max(1, num(m.totalPages, 1)),
      totalAll: num(m.totalAll),
      editedCount: num(m.editedCount),
      pendingCount: num(m.pendingCount),
      exams: Array.isArray(m.exams) ? m.exams.map((e) => str(e)).filter(Boolean) : [],
      years: Array.isArray(m.years) ? m.years.map((y) => num(y)).filter((y) => y > 0) : [],
    },
  };
}

export const parseRevisions = (v: unknown, id: string): CertificateRevision[] =>
  objArray(v, CERT_PATHS.revisions(id)).map((r) => ({
    id: num(r.id),
    created_at: str(r.created_at),
    changes: Array.isArray(r.changes)
      ? r.changes
          .filter(isObj)
          .map((c) => ({ field: str(c.field), from: cell(c.from), to: cell(c.to) }))
      : [],
  }));

export function createCertificatesApi(client: ApiClient) {
  return {
    async list(p: CertificateParams, signal?: AbortSignal): Promise<CertificateList> {
      return parseCertificateList(
        await client.get<unknown>(CERT_PATHS.list, { query: certificateQuery(p), signal }),
      );
    },
    async revisions(id: string, signal?: AbortSignal): Promise<CertificateRevision[]> {
      return parseRevisions(await client.get<unknown>(CERT_PATHS.revisions(id), { signal }), id);
    },
    async setStatus(id: string, status: CertificateStatus): Promise<void> {
      await client.patch<unknown>(CERT_PATHS.status(id), { status });
    },
    pdf(id: string, withAddress: boolean): Promise<ArrayBuffer> {
      return client.get<ArrayBuffer>(CERT_PATHS.pdf(id), {
        query: withAddress ? {} : { address: 'false' },
        responseType: 'arrayBuffer',
        timeoutMs: 120_000,
      });
    },
    async remove(id: string): Promise<void> {
      await client.delete<unknown>(CERT_PATHS.one(id));
    },
  };
}

export type CertificatesApi = ReturnType<typeof createCertificatesApi>;
