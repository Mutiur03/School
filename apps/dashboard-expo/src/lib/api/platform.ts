/**
 * Platform (super-admin) endpoints, the exact set the web super-admin pages call
 * (dashboard/src/pages/SuperAdmin/*), verified against server/src/modules/school/school.route.ts,
 * exam/exam-type.route.ts and auth/auth.route.ts. Every one is `authenticate(['super_admin'])`,
 * and the server re-checks the super-admin host on every super_admin request
 * (assertSuperAdminHostAllowed). Nothing here is privileged in itself: without a super_admin
 * session issued on the super-admin host each call is a 401/403.
 *
 * This client is only constructed in platform mode (see ApiProvider), so a school session never
 * even holds these functions.
 */
import type { ApiClient } from './client';
import { normalizeSchoolCode } from './school-codes';
import { ApiError } from './errors';
import {
  bool,
  isObj,
  num,
  numOrNull,
  objArray,
  parseError,
  str,
  strOrNull,
  type Json,
} from './parse';
import type { SubscriptionStatus } from './billing';
import { parsePresigned, putToPresignedUrl, type PickedFile } from './uploads';

export const PLATFORM_PATHS = {
  schools: '/api/schools',
  school: (id: number) => `/api/schools/${id}`,
  assetUploadUrl: '/api/schools/logo-upload-url',
  billing: (id: number) => `/api/schools/${id}/billing`,
  rotatePasswords: (id: number) => `/api/schools/${id}/rotate-student-passwords`,
  exportStudents: (id: number) => `/api/schools/${id}/students/export`,
  smsOverview: '/api/schools/sms-overview',
  smsCredentials: (id: number) => `/api/schools/${id}/sms-credentials`,
  smsBalance: (id: number) => `/api/schools/${id}/sms-balance`,
  platformCode: '/api/auth/super_admin/platform-code',
  admins: (schoolId: number) => `/api/auth/super_admin/schools/${schoolId}/admins`,
  admin: (schoolId: number, adminId: number) =>
    `/api/auth/super_admin/schools/${schoolId}/admins/${adminId}`,
  examTypes: '/api/exam-types',
  examType: (id: number) => `/api/exam-types/${id}`,
  schoolExamTypes: (schoolId: number) => `/api/exam-types/school/${schoolId}`,
} as const;

/** Ids go into paths: only positive integers, never a string from a URL param as-is. */
export function assertId(id: number, what = 'id'): number {
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError({ kind: 'config', message: `Invalid ${what}.` });
  }
  return id;
}

const STATUSES: readonly SubscriptionStatus[] = [
  'trialing',
  'active',
  'past_due',
  'suspended',
  'expired',
  'cancelled',
];
const statusOrNull = (v: unknown): SubscriptionStatus | null =>
  STATUSES.find((s) => s === v) ?? null;

// ─── Schools ────────────────────────────────────────────────────────────────

export interface SubscriptionSummary {
  status: SubscriptionStatus | null;
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
}

export interface PlatformSchool {
  id: number;
  name: string;
  shortName: string | null;
  nameBn: string | null;
  eiin: string | null;
  centerCode: string | null;
  schoolCode: string | null;
  subjectGroups: string | null;
  medium: string | null;
  board: string | null;
  ownership: string | null;
  gender: string | null;
  promotionVersion: string | null;
  logo: string;
  headerLogo: string | null;
  bannerUrls: string[];
  district: string;
  upazila: string;
  address: string | null;
  phone: string;
  email: string;
  mapEmbedUrl: string | null;
  establishedIn: number | null;
  nationalizedYear: string | null;
  resultsUrl: string | null;
  teacherLoginUrl: string | null;
  studentLoginUrl: string | null;
  subdomain: string | null;
  customDomain: string | null;
  gaMeasurementId: string | null;
  descriptions: { main: string; sub: string };
  academicProfile: Record<AcademicKey, string>;
  subscription: SubscriptionSummary | null;
}

export const ACADEMIC_KEYS = [
  'grades',
  'ageRange',
  'enrollment',
  'studentTeacherRatio',
  'colors',
  'campusArea',
  'playgroundArea',
] as const;
export type AcademicKey = (typeof ACADEMIC_KEYS)[number];

const s = (v: unknown) => (typeof v === 'string' ? v : '');

export function parsePlatformSchool(v: Json): PlatformSchool | null {
  const id = num(v.id, Number.NaN);
  if (!Number.isInteger(id) || id <= 0) return null;
  const sub = isObj(v.subscription) ? v.subscription : null;
  const descriptions = isObj(v.descriptions) ? v.descriptions : {};
  const academic = isObj(v.academicProfile) ? v.academicProfile : {};
  return {
    id,
    name: str(v.name),
    shortName: strOrNull(v.shortName),
    nameBn: strOrNull(v.nameBn),
    eiin: strOrNull(v.eiin),
    centerCode: strOrNull(v.centerCode),
    schoolCode: strOrNull(v.schoolCode),
    subjectGroups: strOrNull(v.subjectGroups),
    medium: strOrNull(v.medium),
    board: strOrNull(v.board),
    ownership: strOrNull(v.ownership),
    gender: strOrNull(v.gender),
    promotionVersion: strOrNull(v.promotionVersion),
    logo: str(v.logo),
    headerLogo: strOrNull(v.headerLogo),
    bannerUrls: Array.isArray(v.bannerUrls)
      ? v.bannerUrls.filter((b): b is string => typeof b === 'string' && b.trim() !== '')
      : [],
    district: str(v.district),
    upazila: str(v.upazila),
    address: strOrNull(v.address),
    phone: str(v.phone),
    email: str(v.email),
    mapEmbedUrl: strOrNull(v.mapEmbedUrl),
    establishedIn: numOrNull(v.establishedIn),
    nationalizedYear: strOrNull(v.nationalizedYear),
    resultsUrl: strOrNull(v.resultsUrl),
    teacherLoginUrl: strOrNull(v.teacherLoginUrl),
    studentLoginUrl: strOrNull(v.studentLoginUrl),
    subdomain: strOrNull(v.subdomain),
    customDomain: strOrNull(v.customDomain),
    gaMeasurementId: strOrNull(v.gaMeasurementId),
    descriptions: { main: s(descriptions.main), sub: s(descriptions.sub) },
    academicProfile: Object.fromEntries(ACADEMIC_KEYS.map((k) => [k, s(academic[k])])) as Record<
      AcademicKey,
      string
    >,
    subscription: sub
      ? {
          status: statusOrNull(sub.status),
          trial_ends_at: strOrNull(sub.trial_ends_at),
          current_period_ends_at: strOrNull(sub.current_period_ends_at),
        }
      : null,
  };
}

// ─── Billing ────────────────────────────────────────────────────────────────

export interface SchoolSubscription {
  status: SubscriptionStatus;
  plan_name: string;
  annual_price: number | null;
  currency: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  subscription_started_at: string | null;
  current_period_started_at: string | null;
  current_period_ends_at: string | null;
  cancelled_at: string | null;
  notes: string | null;
  access_state: 'active' | 'grace' | 'locked';
  grace_ends_at: string | null;
}

export function parseSchoolSubscription(v: unknown, path: string): SchoolSubscription {
  if (!isObj(v)) throw parseError(path);
  const status = statusOrNull(v.status);
  if (!status) throw parseError(path);
  const access =
    v.access_state === 'active' || v.access_state === 'grace' ? v.access_state : 'locked';
  return {
    status,
    plan_name: str(v.plan_name, 'Annual'),
    annual_price: numOrNull(v.annual_price),
    currency: str(v.currency, 'BDT') || 'BDT',
    trial_started_at: strOrNull(v.trial_started_at),
    trial_ends_at: strOrNull(v.trial_ends_at),
    subscription_started_at: strOrNull(v.subscription_started_at),
    current_period_started_at: strOrNull(v.current_period_started_at),
    current_period_ends_at: strOrNull(v.current_period_ends_at),
    cancelled_at: strOrNull(v.cancelled_at),
    notes: strOrNull(v.notes),
    access_state: access,
    grace_ends_at: strOrNull(v.grace_ends_at),
  };
}

/** Body for PUT /:id/billing, already validated with updateSubscriptionSchema. */
export interface SubscriptionUpdateBody {
  status: SubscriptionStatus;
  annual_price?: number | null;
  currency: string;
  trial_started_at: Date | string | null;
  trial_ends_at: Date | string | null;
  subscription_started_at: Date | string | null;
  current_period_started_at: Date | string | null;
  current_period_ends_at: Date | string | null;
  cancelled_at: Date | string | null;
  notes?: string | null;
}

// ─── SMS ────────────────────────────────────────────────────────────────────

export interface SmsOverviewRow {
  school_id: number;
  school_name: string;
  logo: string | null;
  configured: boolean;
  self_hosted: boolean;
  is_active: boolean;
  service_type: string | null;
  sender_id: string | null;
  estimated_sms: number | null;
  balance_message: string | null;
}

export interface SmsOverview {
  system: { estimated_sms: number | null; message: string | null };
  schools: SmsOverviewRow[];
}

export function parseSmsOverview(v: unknown): SmsOverview {
  const path = PLATFORM_PATHS.smsOverview;
  if (!isObj(v)) throw parseError(path);
  const system = isObj(v.system) ? v.system : {};
  return {
    system: { estimated_sms: numOrNull(system.estimated_sms), message: strOrNull(system.message) },
    schools: objArray(v.schools ?? [], path)
      .map((r) => ({
        school_id: num(r.school_id, Number.NaN),
        school_name: str(r.school_name),
        logo: strOrNull(r.logo),
        configured: bool(r.configured),
        self_hosted: bool(r.self_hosted),
        is_active: bool(r.is_active),
        service_type: strOrNull(r.service_type),
        sender_id: strOrNull(r.sender_id),
        estimated_sms: numOrNull(r.estimated_sms),
        balance_message: strOrNull(r.balance_message),
      }))
      .filter((r) => Number.isInteger(r.school_id) && r.school_id > 0),
  };
}

export interface SmsCredentials {
  api_key_masked: string | null;
  api_url: string;
  sender_id: string;
  service_type: string | null;
  estimated_sms: number | null;
  balance_message: string | null;
}

export function parseSmsCredentials(v: unknown): SmsCredentials {
  const r = isObj(v) ? v : {};
  return {
    api_key_masked: strOrNull(r.api_key_masked),
    api_url: s(r.api_url),
    sender_id: s(r.sender_id),
    service_type: strOrNull(r.service_type),
    estimated_sms: numOrNull(r.estimated_sms),
    balance_message: strOrNull(r.balance_message),
  };
}

/** Only the writable fields (sms-credentials.sanitize.ts); `api_key: null` = back to shared. */
export interface SmsCredentialsUpdate {
  api_url?: string | null;
  sender_id?: string | null;
  service_type?: string;
  api_key?: string | null;
}

// ─── Admins ─────────────────────────────────────────────────────────────────

export interface SchoolAdmin {
  id: number;
  username: string;
  role: string;
}

// ─── Exam types ─────────────────────────────────────────────────────────────

export interface ExamTypeUsage {
  school_id: number;
  school_name: string;
  exam_year: number;
  levels: number[];
}

export interface PlatformExamType {
  id: number;
  name: string;
  is_year_end: boolean;
  sort_order: number;
  assign_to_new_schools: boolean;
  exam_count: number;
  school_ids: number[];
  used_by: ExamTypeUsage[];
}

export function parseExamType(r: Json): PlatformExamType | null {
  const id = num(r.id, Number.NaN);
  if (!Number.isInteger(id) || id <= 0) return null;
  return {
    id,
    name: str(r.name),
    is_year_end: bool(r.is_year_end),
    sort_order: num(r.sort_order),
    assign_to_new_schools: bool(r.assign_to_new_schools),
    exam_count: num(r.exam_count),
    school_ids: Array.isArray(r.school_ids)
      ? r.school_ids.map((x) => num(x, Number.NaN)).filter((x) => Number.isInteger(x) && x > 0)
      : [],
    used_by: Array.isArray(r.used_by)
      ? r.used_by.filter(isObj).map((u) => ({
          school_id: num(u.school_id),
          school_name: str(u.school_name),
          exam_year: num(u.exam_year),
          levels: Array.isArray(u.levels) ? u.levels.map((l) => num(l)).filter((l) => l > 0) : [],
        }))
      : [],
  };
}

export interface ExamTypeBody {
  name: string;
  is_year_end: boolean;
  sort_order: number;
  assign_to_new_schools: boolean;
}

export interface ExamTypeCascade {
  updated: number;
  skipped_frozen: number;
  skipped_overlap: number;
}

// ─── Client ─────────────────────────────────────────────────────────────────

export type SchoolAssetKind = 'logo' | 'header' | 'banner';

export function createPlatformApi(client: ApiClient, fetchImpl?: typeof fetch) {
  const assetUploadUrl = async (file: PickedFile, kind: SchoolAssetKind) =>
    parsePresigned(
      await client.post<unknown>(PLATFORM_PATHS.assetUploadUrl, {
        fileName: file.name,
        contentType: file.type || 'image/png',
        kind,
      }),
      PLATFORM_PATHS.assetUploadUrl,
    );

  return {
    /**
     * The platform access code (server env PLATFORM_ACCESS_CODE) to show as a QR, or null when it
     * is not set up. A server without the endpoint (404) is "not set up" too. Only a well-formed
     * code is shown.
     */
    async getPlatformCode(signal?: AbortSignal): Promise<string | null> {
      try {
        const data = await client.get<unknown>(PLATFORM_PATHS.platformCode, { signal });
        const code = isObj(data) && typeof data.code === 'string' ? data.code : '';
        return normalizeSchoolCode(code);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    async listSchools(signal?: AbortSignal): Promise<PlatformSchool[]> {
      const data = await client.get<unknown>(PLATFORM_PATHS.schools, { signal });
      return objArray(data, PLATFORM_PATHS.schools)
        .map(parsePlatformSchool)
        .filter((x): x is PlatformSchool => x !== null);
    },
    /** POST /api/schools: createSchoolSchema (school + initialAdmin + trialEndsAt). */
    async createSchool(body: object): Promise<{ id: number | null }> {
      const data = await client.post<unknown>(PLATFORM_PATHS.schools, body);
      const id = isObj(data) ? num(data.id, Number.NaN) : Number.NaN;
      return { id: Number.isInteger(id) && id > 0 ? id : null };
    },
    async updateSchool(id: number, body: object): Promise<void> {
      await client.put<unknown>(PLATFORM_PATHS.school(assertId(id, 'school')), body);
    },
    /** Signed PUT to storage (no auth header, no cookies), then the key to save. */
    async uploadAsset(kind: SchoolAssetKind, file: PickedFile): Promise<string> {
      const { uploadUrl, key } = await assetUploadUrl(file, kind);
      await putToPresignedUrl(uploadUrl, { ...file, type: file.type || 'image/png' }, fetchImpl);
      return key;
    },
    async getBilling(id: number, signal?: AbortSignal): Promise<SchoolSubscription> {
      const path = PLATFORM_PATHS.billing(assertId(id, 'school'));
      return parseSchoolSubscription(await client.get<unknown>(path, { signal }), path);
    },
    async updateBilling(id: number, body: SubscriptionUpdateBody): Promise<SchoolSubscription> {
      const path = PLATFORM_PATHS.billing(assertId(id, 'school'));
      return parseSchoolSubscription(await client.put<unknown>(path, body), path);
    },
    rotateStudentPasswords: (id: number) =>
      client.post<ArrayBuffer>(PLATFORM_PATHS.rotatePasswords(assertId(id, 'school')), undefined, {
        responseType: 'arrayBuffer',
        timeoutMs: 120_000,
      }),
    exportStudents: (id: number) =>
      client.get<ArrayBuffer>(PLATFORM_PATHS.exportStudents(assertId(id, 'school')), {
        responseType: 'arrayBuffer',
        timeoutMs: 120_000,
      }),
    async smsOverview(signal?: AbortSignal): Promise<SmsOverview> {
      return parseSmsOverview(await client.get<unknown>(PLATFORM_PATHS.smsOverview, { signal }));
    },
    async getSmsCredentials(id: number, signal?: AbortSignal): Promise<SmsCredentials> {
      return parseSmsCredentials(
        await client.get<unknown>(PLATFORM_PATHS.smsCredentials(assertId(id, 'school')), {
          signal,
        }),
      );
    },
    async updateSmsCredentials(id: number, body: SmsCredentialsUpdate): Promise<SmsCredentials> {
      return parseSmsCredentials(
        await client.put<unknown>(PLATFORM_PATHS.smsCredentials(assertId(id, 'school')), body),
      );
    },
    /** Shared-account top-up only (the server refuses self-hosted schools). */
    async addSmsBalance(id: number, amount: number): Promise<number | null> {
      if (!Number.isInteger(amount) || amount <= 0) {
        throw new ApiError({ kind: 'config', message: 'Enter a valid amount.' });
      }
      const data = await client.post<unknown>(PLATFORM_PATHS.smsBalance(assertId(id, 'school')), {
        amount,
      });
      return isObj(data) ? numOrNull(data.sms_balance) : null;
    },
    async listAdmins(schoolId: number, signal?: AbortSignal): Promise<SchoolAdmin[]> {
      const path = PLATFORM_PATHS.admins(assertId(schoolId, 'school'));
      const data = await client.get<unknown>(path, { signal });
      return (Array.isArray(data) ? data.filter(isObj) : [])
        .map((a) => ({ id: num(a.id, Number.NaN), username: str(a.username), role: str(a.role) }))
        .filter((a) => Number.isInteger(a.id) && a.id > 0);
    },
    async addAdmin(schoolId: number, body: { username: string; password: string }) {
      await client.post<unknown>(PLATFORM_PATHS.admins(assertId(schoolId, 'school')), body);
    },
    async deleteAdmin(schoolId: number, adminId: number) {
      await client.delete<unknown>(
        PLATFORM_PATHS.admin(assertId(schoolId, 'school'), assertId(adminId, 'admin')),
      );
    },
    async listExamTypes(signal?: AbortSignal): Promise<PlatformExamType[]> {
      const data = await client.get<unknown>(PLATFORM_PATHS.examTypes, { signal });
      return objArray(data, PLATFORM_PATHS.examTypes)
        .map(parseExamType)
        .filter((x): x is PlatformExamType => x !== null);
    },
    async createExamType(body: ExamTypeBody): Promise<void> {
      await client.post<unknown>(PLATFORM_PATHS.examTypes, body);
    },
    async updateExamType(id: number, body: ExamTypeBody): Promise<ExamTypeCascade | null> {
      const data = await client.put<unknown>(
        PLATFORM_PATHS.examType(assertId(id, 'exam type')),
        body,
      );
      const cascade = isObj(data) && isObj(data.cascade) ? data.cascade : null;
      return cascade
        ? {
            updated: num(cascade.updated),
            skipped_frozen: num(cascade.skipped_frozen),
            skipped_overlap: num(cascade.skipped_overlap),
          }
        : null;
    },
    async deleteExamType(id: number): Promise<void> {
      await client.delete<unknown>(PLATFORM_PATHS.examType(assertId(id, 'exam type')));
    },
    async setSchoolExamTypes(schoolId: number, examTypeIds: number[]): Promise<void> {
      await client.put<unknown>(PLATFORM_PATHS.schoolExamTypes(assertId(schoolId, 'school')), {
        exam_type_ids: examTypeIds.map((id) => assertId(id, 'exam type')),
      });
    },
  };
}

export type PlatformApi = ReturnType<typeof createPlatformApi>;
