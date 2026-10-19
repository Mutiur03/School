/**
 * Class 6 / 8 / 9 and Junior Scholarship registrations (legacy Express, one factory each),
 * verified against server/src/modules/registration/** and dashboard/src/pages/Admin/ClassRegForm:
 *
 *   GET    /api/reg/<v>?<yearField>=YYYY         public; the year's settings row (id 0 = none
 *                                                yet, defaults filled in); no year = latest
 *   POST   /api/reg/<v> { …settings, notice_key? }    admin; upsert for that year
 *   DELETE /api/reg/<v>/notice?<yearField>=YYYY    admin; removes that year's notice
 *   POST   /api/reg/<v>/upload-url { filename, filetype }   admin → { uploadUrl, key }
 *   GET    /api/reg/<v>/form?page&limit&<yearParam>&status&section&search&sort&order   admin
 *          → { data, meta { total, pending, approved, totalPages } }
 *   PUT    /api/reg/<v>/form/:id/status { status }  (status guard server-side)
 *   DELETE /api/reg/<v>/form/:id                admin
 *   GET    /api/reg/<v>/form/:id/pdf            PDF
 *   GET    /api/reg/<v>/form/export | /export-photos ?status&section&<yearParam>   admin;
 *          .xlsx / .zip built by the server
 *
 * Saving settings writes `notice: null` unless a notice_key is sent, so the current stored key
 * is sent back when no new PDF was picked (the server re-checks it belongs to this school).
 */
import type { ApiClient } from './client';
import { ApiError } from './errors';
import { isPdf } from './notices';
import { isObj, num, objArray, parseError, str, strOrNull, type Json } from './parse';
import { parsePresigned, putToPresignedUrl, type PickedFile } from './uploads';

export type RegVariant = 'class-6' | 'class-8' | 'class-9' | 'junior-scholarship';

export interface RegConfig {
  variant: RegVariant;
  base: string;
  title: string;
  /** Settings year field (GET param and body key). */
  yearField: 'class6_year' | 'class8_year' | 'ssc_year' | 'jse_year';
  /** List / export year param. */
  listYearParam: 'class6_year' | 'class8_year' | 'ssc_year' | 'jse_year';
  yearLabel: string;
  /** "2026" or "SSC 2026". */
  yearText: (y: string | number) => string;
  exportPrefix: string;
  pdfPrefix: string;
  settingsDesc: string;
  enrollmentHint: string;
}

export const REG_CONFIG: Record<RegVariant, RegConfig> = {
  'class-6': {
    variant: 'class-6',
    base: '/api/reg/class-6',
    title: 'Class 6 Registration',
    yearField: 'class6_year',
    listYearParam: 'class6_year',
    yearLabel: 'Academic year',
    yearText: (y) => String(y),
    exportPrefix: 'Class6_',
    pdfPrefix: 'Class6_Registration_',
    settingsDesc: 'Settings are saved separately for each academic year.',
    enrollmentHint: 'Automatically uses names from the Class 6 enrollment list.',
  },
  'class-8': {
    variant: 'class-8',
    base: '/api/reg/class-8',
    title: 'Class 8 Registration',
    yearField: 'class8_year',
    listYearParam: 'class8_year',
    yearLabel: 'Academic year',
    yearText: (y) => String(y),
    exportPrefix: 'Class8_',
    pdfPrefix: 'Class8_Registration_',
    settingsDesc: 'Settings are saved separately for each academic year.',
    enrollmentHint: 'Automatically uses names from the Class 8 enrollment list.',
  },
  'class-9': {
    variant: 'class-9',
    base: '/api/reg/class-9',
    title: 'Class 9 Registration',
    yearField: 'ssc_year',
    listYearParam: 'ssc_year',
    yearLabel: 'SSC batch',
    yearText: (y) => `SSC ${y}`,
    exportPrefix: 'Class_9_',
    pdfPrefix: 'Class9_Registration_',
    settingsDesc: 'Settings are saved separately for each SSC batch.',
    enrollmentHint: 'Automatically uses names from the Class 10 enrollment list.',
  },
  'junior-scholarship': {
    variant: 'junior-scholarship',
    base: '/api/reg/junior-scholarship',
    title: 'Junior Scholarship Exam',
    yearField: 'jse_year',
    listYearParam: 'jse_year',
    yearLabel: 'Exam year',
    yearText: (y) => String(y),
    exportPrefix: 'JuniorScholarship_',
    pdfPrefix: 'JuniorScholarship_',
    settingsDesc: 'Settings are saved separately for each exam year.',
    enrollmentHint: 'Automatically uses names from the Class 8 enrollment list.',
  },
};

export interface RegSettings {
  /** False when the server returned its defaults (id 0): "Create settings". */
  exists: boolean;
  year: number;
  reg_open: boolean;
  a_sec_roll: string;
  b_sec_roll: string;
  instruction_for_a: string;
  instruction_for_b: string;
  attachment_instruction: string;
  classmates: string;
  classmates_source: 'default' | 'custom';
  notice: string | null;
}

const listText = (v: unknown) =>
  Array.isArray(v)
    ? v
        .map((x) => str(x))
        .filter(Boolean)
        .join(', ')
    : str(v);

export function parseRegSettings(v: unknown, cfg: RegConfig, fallbackYear: number): RegSettings {
  if (!isObj(v)) throw parseError(cfg.base);
  return {
    exists: num(v.id) > 0,
    year: num(v[cfg.yearField]) || fallbackYear,
    reg_open: v.reg_open === true || v.reg_open === 'true',
    a_sec_roll: str(v.a_sec_roll),
    b_sec_roll: str(v.b_sec_roll),
    instruction_for_a: str(v.instruction_for_a),
    instruction_for_b: str(v.instruction_for_b),
    attachment_instruction: str(v.attachment_instruction),
    classmates: listText(v.classmates),
    classmates_source: v.classmates_source === 'custom' ? 'custom' : 'default',
    notice: strOrNull(v.notice),
  };
}

export type RegStatus = 'pending' | 'approved';
export type RegSort = 'name' | 'section' | 'roll' | 'status' | 'date';

export interface Registration {
  id: string;
  status: string;
  name: string;
  nameBn: string | null;
  section: string;
  roll: string;
  submitted: string;
  photo: string | null;
  fields: Record<string, string>;
}

export interface RegListParams {
  page: number;
  limit: number;
  year: string;
  status: readonly RegStatus[];
  sections: readonly string[];
  search: string;
  sort?: RegSort;
  order?: 'asc' | 'desc';
}

const text = (v: unknown) =>
  v === null || v === undefined || typeof v === 'object' ? '' : String(v).trim();

export function parseRegistration(r: Json): Registration {
  return {
    id: str(r.id),
    status: str(r.status, 'pending'),
    name: str(r.student_name_en),
    nameBn: strOrNull(r.student_name_bn),
    section: str(r.section),
    roll: str(r.roll),
    submitted: str(r.created_at),
    photo: strOrNull(r.photo) ?? strOrNull(r.photo_path),
    fields: Object.fromEntries(
      Object.entries(r)
        .map(([k, v]) => [k, text(v)] as const)
        .filter(([, v]) => v !== ''),
    ),
  };
}

/** Status / section: one ticked = filter, none or both = all (as on the web). */
export function regFilterQuery(cfg: RegConfig, p: Omit<RegListParams, 'page' | 'limit'>) {
  const q: Record<string, string> = {
    [cfg.listYearParam]: p.year,
    status: p.status.length === 1 ? p.status[0]! : 'all',
    section: p.sections.length === 1 ? p.sections[0]! : '',
  };
  return q;
}

export function regListQuery(cfg: RegConfig, p: RegListParams) {
  return {
    page: p.page,
    limit: p.limit,
    ...regFilterQuery(cfg, p),
    ...(p.search.trim() ? { search: p.search.trim() } : {}),
    ...(p.sort ? { sort: p.sort, order: p.order ?? 'asc' } : {}),
  };
}

export interface RegList {
  rows: Registration[];
  meta: { total: number; pending: number; approved: number; totalPages: number };
}

export function parseRegList(v: unknown, path: string): RegList {
  if (!isObj(v) || !Array.isArray(v.data)) throw parseError(path);
  const m = isObj(v.meta) ? v.meta : {};
  return {
    rows: objArray(v.data, path).map(parseRegistration),
    meta: {
      total: num(m.total),
      pending: num(m.pending),
      approved: num(m.approved),
      totalPages: Math.max(1, num(m.totalPages, 1)),
    },
  };
}

export interface RegSettingsInput {
  year: string;
  reg_open: boolean;
  a_sec_roll: string;
  b_sec_roll: string;
  instruction_for_a: string;
  instruction_for_b: string;
  attachment_instruction: string;
  classmates: string;
  classmates_source: 'default' | 'custom';
}

/** Body for POST /api/reg/<v>: the year under its own key, reg_open as the web sends it. */
export function regSettingsBody(
  cfg: RegConfig,
  input: RegSettingsInput,
  noticeKey: string | null,
): Record<string, unknown> {
  return {
    a_sec_roll: input.a_sec_roll.trim(),
    b_sec_roll: input.b_sec_roll.trim(),
    [cfg.yearField]: input.year.trim(),
    reg_open: input.reg_open ? 'true' : 'false',
    instruction_for_a: input.instruction_for_a,
    instruction_for_b: input.instruction_for_b,
    attachment_instruction: input.attachment_instruction,
    classmates_source: input.classmates_source,
    // The default source resolves names from enrollments on read; don't store that list.
    classmates: input.classmates_source === 'custom' ? input.classmates.trim() : '',
    ...(noticeKey ? { notice_key: noticeKey } : {}),
  };
}

/** A stored key we can safely send back (legacy absolute URLs are not keys). */
export const reusableKey = (k: string | null) => (k && !/^https?:\/\//i.test(k) ? k : null);

export function createRegistrationApi(client: ApiClient, fetchImpl?: typeof fetch) {
  const form = (cfg: RegConfig) => `${cfg.base}/form`;
  return {
    async settings(cfg: RegConfig, year: string | null, signal?: AbortSignal) {
      const fallback = Number(year) || new Date().getFullYear();
      return parseRegSettings(
        await client.get<unknown>(cfg.base, {
          query: year ? { [cfg.yearField]: year } : {},
          signal,
        }),
        cfg,
        fallback,
      );
    },
    async saveSettings(
      cfg: RegConfig,
      input: RegSettingsInput,
      notice: PickedFile | null,
      current: string | null,
    ): Promise<void> {
      if (!/^\d{4}$/.test(input.year.trim())) {
        throw new ApiError({ kind: 'config', message: 'Enter a 4-digit year', path: cfg.base });
      }
      let key = reusableKey(current);
      if (notice) {
        if (!isPdf(notice)) {
          throw new ApiError({ kind: 'config', message: 'Notice must be a PDF', path: cfg.base });
        }
        const data = await client.post<unknown>(`${cfg.base}/upload-url`, {
          filename: notice.name,
          filetype: 'application/pdf',
        });
        const p = parsePresigned(data, `${cfg.base}/upload-url`);
        await putToPresignedUrl(p.uploadUrl, { ...notice, type: 'application/pdf' }, fetchImpl);
        key = p.key;
      }
      await client.post<unknown>(cfg.base, regSettingsBody(cfg, input, key));
    },
    /** DELETE /api/reg/<v>/notice?<yearField>: removes that year's notice PDF. */
    async removeNotice(cfg: RegConfig, year: string): Promise<void> {
      await client.delete<unknown>(`${cfg.base}/notice`, { query: { [cfg.yearField]: year } });
    },
    async list(cfg: RegConfig, p: RegListParams, signal?: AbortSignal): Promise<RegList> {
      return parseRegList(
        await client.get<unknown>(form(cfg), { query: regListQuery(cfg, p), signal }),
        form(cfg),
      );
    },
    async setStatus(cfg: RegConfig, id: string, status: RegStatus): Promise<void> {
      await client.put<unknown>(`${form(cfg)}/${encodeURIComponent(id)}/status`, { status });
    },
    async remove(cfg: RegConfig, id: string): Promise<void> {
      await client.delete<unknown>(`${form(cfg)}/${encodeURIComponent(id)}`);
    },
    pdf(cfg: RegConfig, id: string): Promise<ArrayBuffer> {
      return client.get<ArrayBuffer>(`${form(cfg)}/${encodeURIComponent(id)}/pdf`, {
        responseType: 'arrayBuffer',
        timeoutMs: 120_000,
      });
    },
    export(
      cfg: RegConfig,
      kind: 'sheet' | 'photos',
      p: Omit<RegListParams, 'page' | 'limit'>,
    ): Promise<ArrayBuffer> {
      return client.get<ArrayBuffer>(
        `${form(cfg)}/${kind === 'sheet' ? 'export' : 'export-photos'}`,
        {
          query: regFilterQuery(cfg, p),
          responseType: 'arrayBuffer',
          timeoutMs: 300_000,
        },
      );
    },
  };
}

export type RegistrationApi = ReturnType<typeof createRegistrationApi>;
