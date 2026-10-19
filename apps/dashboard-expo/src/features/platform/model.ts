/**
 * Pure models for the platform (super-admin) pages, ported from
 * dashboard/src/pages/SuperAdmin/{Dashboard,SmsOverview,ExamTypes,SchoolManagement,
 * SchoolBillingEditor}.tsx. Same rules, same numbers; no React here so it is unit-tested.
 */
import type * as Shared from '@school/shared-schemas';
import type {
  ExamTypeBody,
  ExamTypeCascade,
  PlatformExamType,
  PlatformSchool,
  SchoolSubscription,
  SmsCredentials,
  SmsCredentialsUpdate,
  SmsOverviewRow,
  SubscriptionDateField,
  SubscriptionStatus,
  SubscriptionUpdateBody,
} from '@/lib/api';
import { ACADEMIC_KEYS, type AcademicKey } from '@/lib/api/platform';

const DAY_MS = 86_400_000;

/**
 * The shared schemas/constants these models validate with. `@school/shared-schemas` is ESM-only,
 * so the models take it as an argument (the app passes `platformSchemas`, tests a dynamic import),
 * the same way features/import does.
 */
export type PlatformSchemas = Pick<
  typeof Shared,
  | 'PROMOTION_VERSIONS'
  | 'SCHOOL_BOARDS'
  | 'SCHOOL_GENDERS'
  | 'SCHOOL_MEDIUMS'
  | 'SCHOOL_OWNERSHIPS'
  | 'SUBSCRIPTION_STATUS_FIELDS'
  | 'addAdminSchema'
  | 'examTypeSchema'
  | 'formatSubjectGroups'
  | 'superAdminLoginSchema'
  | 'updateSchoolSchema'
  | 'updateSubscriptionSchema'
>;

// ─── Overview (Dashboard.tsx) ───────────────────────────────────────────────

export const SOON_DAYS = 14;

export function daysUntil(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - now) / DAY_MS);
}

export interface FleetStats {
  total: number;
  trialing: number;
  pastDue: number;
  expiredOrLocked: number;
  trialsEndingSoon: number;
  attention: number;
}

export function fleetStats(
  schools: readonly Pick<PlatformSchool, 'subscription'>[],
  now = Date.now(),
): FleetStats {
  let trialing = 0;
  let pastDue = 0;
  let expiredOrLocked = 0;
  let trialsEndingSoon = 0;
  for (const school of schools) {
    const status = school.subscription?.status ?? null;
    if (status === 'trialing') {
      trialing += 1;
      const days = daysUntil(school.subscription?.trial_ends_at, now);
      if (days !== null && days >= 0 && days <= SOON_DAYS) trialsEndingSoon += 1;
    } else if (status === 'past_due') {
      pastDue += 1;
    } else if (status === 'expired' || status === 'suspended' || status === 'cancelled') {
      expiredOrLocked += 1;
    }
  }
  return {
    total: schools.length,
    trialing,
    pastDue,
    expiredOrLocked,
    trialsEndingSoon,
    attention: pastDue + expiredOrLocked + trialsEndingSoon,
  };
}

// ─── SMS overview (SmsOverview.tsx) ─────────────────────────────────────────

export const LOW_BALANCE_THRESHOLD = 200;

export type SmsMode = 'not-configured' | 'self-hosted' | 'shared';

export const smsMode = (row: Pick<SmsOverviewRow, 'configured' | 'self_hosted'>): SmsMode =>
  !row.configured ? 'not-configured' : row.self_hosted ? 'self-hosted' : 'shared';

export const isLowBalance = (estimated: number | null) =>
  estimated !== null && estimated < LOW_BALANCE_THRESHOLD;

export function smsSummary(rows: readonly SmsOverviewRow[]) {
  return {
    selfHosted: rows.filter((r) => r.self_hosted).length,
    shared: rows.filter((r) => r.configured && !r.self_hosted).length,
    needsAttention: rows.filter((r) => !r.configured || isLowBalance(r.estimated_sms)).length,
  };
}

export function filterByName<T>(rows: readonly T[], query: string, name: (row: T) => string[]) {
  const q = query.trim().toLowerCase();
  if (!q) return [...rows];
  return rows.filter((r) => name(r).some((n) => n.toLowerCase().includes(q)));
}

// ─── SMS credentials (SchoolManagement.tsx onSaveSmsCredentials) ────────────

export const SMS_PROVIDERS = [{ value: 'onecode', label: 'OneCode SMS' }] as const;

/**
 * Only writable fields, never display-only values. Own account (a key is set or being set):
 * send url/sender/provider as shown. Shared: omit blanks so Save doesn't trip validation.
 */
export function smsCredentialsPayload(
  creds: Pick<SmsCredentials, 'api_key_masked' | 'api_url' | 'sender_id' | 'service_type'>,
  apiKeyDraft: string,
): SmsCredentialsUpdate {
  const draft = apiKeyDraft.trim();
  const ownAccount = Boolean(creds.api_key_masked) || Boolean(draft);
  const payload: SmsCredentialsUpdate = {};
  const apiUrl = (creds.api_url ?? '').trim();
  const senderId = (creds.sender_id ?? '').trim();
  if (ownAccount) {
    payload.api_url = creds.api_url;
    payload.sender_id = creds.sender_id;
    payload.service_type = creds.service_type ?? SMS_PROVIDERS[0].value;
  } else {
    if (apiUrl) payload.api_url = apiUrl;
    if (senderId) payload.sender_id = senderId;
    if (typeof creds.service_type === 'string' && creds.service_type.trim() !== '') {
      payload.service_type = creds.service_type;
    }
  }
  if (draft) payload.api_key = draft;
  return payload;
}

/** "Switch to shared": clearing the key is the whole request. */
export const SWITCH_TO_SHARED_PAYLOAD: SmsCredentialsUpdate = { api_key: null };

export function parseBalanceAmount(raw: string): number | null {
  if (!/^\s*\d+\s*$/.test(raw)) return null;
  const n = parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// ─── Billing (SchoolBillingEditor.tsx) ──────────────────────────────────────

export interface BillingForm {
  status: SubscriptionStatus;
  annual_price: string;
  currency: string;
  trial_started_at: string;
  trial_ends_at: string;
  subscription_started_at: string;
  current_period_started_at: string;
  current_period_ends_at: string;
  cancelled_at: string;
  notes: string;
}

export const BILLING_DATE_FIELDS: readonly SubscriptionDateField[] = [
  'trial_started_at',
  'trial_ends_at',
  'subscription_started_at',
  'current_period_started_at',
  'current_period_ends_at',
  'cancelled_at',
];

export const BILLING_DATE_LABELS: Record<SubscriptionDateField, string> = {
  trial_started_at: 'Trial starts',
  trial_ends_at: 'Trial ends',
  subscription_started_at: 'Subscription starts',
  current_period_started_at: 'Current annual period starts',
  current_period_ends_at: 'Current annual period ends',
  cancelled_at: 'Cancelled on',
};

export const END_DATE_FIELDS = new Set<SubscriptionDateField>([
  'trial_ends_at',
  'current_period_ends_at',
]);

/** YYYY-MM-DD in UTC, '' when missing/invalid (dateInputValue in types/billing.ts). */
export function dateInputValue(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export const todayInput = (now = new Date()) => now.toISOString().slice(0, 10);

export function shiftDateInput(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function shiftYearInput(value: string, years: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString().slice(0, 10);
}

export const toBillingForm = (v: SchoolSubscription): BillingForm => ({
  status: v.status,
  annual_price: v.annual_price == null ? '' : String(v.annual_price),
  currency: v.currency,
  trial_started_at: dateInputValue(v.trial_started_at),
  trial_ends_at: dateInputValue(v.trial_ends_at),
  subscription_started_at: dateInputValue(v.subscription_started_at),
  current_period_started_at: dateInputValue(v.current_period_started_at),
  current_period_ends_at: dateInputValue(v.current_period_ends_at),
  cancelled_at: dateInputValue(v.cancelled_at),
  notes: v.notes ?? '',
});

/** Fill the dates the new status needs; clear the ones it doesn't show. */
export function applyStatusDefaults(
  form: BillingForm,
  status: SubscriptionStatus,
  schemas: Pick<PlatformSchemas, 'SUBSCRIPTION_STATUS_FIELDS'>,
  now = new Date(),
): BillingForm {
  const today = todayInput(now);
  const visible = new Set(schemas.SUBSCRIPTION_STATUS_FIELDS[status].visible);
  const next: BillingForm = { ...form, status };
  for (const field of BILLING_DATE_FIELDS) if (!visible.has(field)) next[field] = '';
  switch (status) {
    case 'trialing':
      next.trial_started_at = form.trial_started_at || today;
      next.trial_ends_at = form.trial_ends_at || shiftDateInput(today, 30);
      break;
    case 'active':
      next.subscription_started_at = form.subscription_started_at || today;
      next.current_period_started_at = form.current_period_started_at || today;
      next.current_period_ends_at = form.current_period_ends_at || shiftYearInput(today, 1);
      break;
    case 'past_due':
      next.subscription_started_at =
        form.subscription_started_at || form.current_period_started_at || today;
      next.current_period_started_at =
        form.current_period_started_at || form.subscription_started_at || today;
      next.current_period_ends_at = form.current_period_ends_at || today;
      break;
    case 'suspended':
      break;
    case 'expired':
      next.subscription_started_at =
        form.subscription_started_at || form.current_period_started_at || today;
      next.current_period_started_at =
        form.current_period_started_at || form.subscription_started_at || today;
      next.current_period_ends_at =
        form.current_period_ends_at && form.current_period_ends_at < today
          ? form.current_period_ends_at
          : shiftDateInput(today, -1);
      break;
    case 'cancelled':
      next.cancelled_at = form.cancelled_at || today;
      break;
  }
  return next;
}

/** Set one field, keeping paired ranges valid when one side moves (web `update`). */
export function updateBillingField<K extends keyof BillingForm>(
  current: BillingForm,
  key: K,
  value: BillingForm[K],
): BillingForm {
  const next = { ...current, [key]: value };
  if (!BILLING_DATE_FIELDS.includes(key as SubscriptionDateField)) return next;
  if (
    key === 'trial_started_at' &&
    next.trial_ends_at &&
    next.trial_started_at &&
    next.trial_ends_at < next.trial_started_at
  ) {
    next.trial_ends_at = next.trial_started_at;
  }
  if (
    key === 'trial_ends_at' &&
    next.trial_started_at &&
    next.trial_ends_at &&
    next.trial_ends_at < next.trial_started_at
  ) {
    next.trial_started_at = next.trial_ends_at;
  }
  if (
    key === 'subscription_started_at' &&
    next.current_period_started_at &&
    next.subscription_started_at &&
    next.current_period_started_at < next.subscription_started_at
  ) {
    next.current_period_started_at = next.subscription_started_at;
  }
  if (
    (key === 'current_period_started_at' || key === 'subscription_started_at') &&
    next.current_period_ends_at
  ) {
    const floor = next.current_period_started_at || next.subscription_started_at;
    if (floor && next.current_period_ends_at < floor) next.current_period_ends_at = floor;
  }
  if (
    key === 'current_period_ends_at' &&
    next.current_period_started_at &&
    next.current_period_ends_at &&
    next.current_period_ends_at < next.current_period_started_at
  ) {
    next.current_period_started_at = next.current_period_ends_at;
  }
  return next;
}

export const isoDate = (value: string, endOfDay = false) =>
  value ? new Date(`${value}T${endOfDay ? '23:59:59.999Z' : '00:00:00.000Z'}`).toISOString() : null;

/** Same payload and validation as the web; the server validates it again. */
export function billingPayload(
  form: BillingForm,
  schemas: Pick<PlatformSchemas, 'updateSubscriptionSchema'>,
): { ok: true; value: SubscriptionUpdateBody } | { ok: false; error: string } {
  const payload = {
    status: form.status,
    annual_price: form.annual_price === '' ? null : Number(form.annual_price),
    currency: form.currency,
    trial_started_at: isoDate(form.trial_started_at),
    trial_ends_at: isoDate(form.trial_ends_at, true),
    subscription_started_at: isoDate(form.subscription_started_at),
    current_period_started_at: isoDate(form.current_period_started_at),
    current_period_ends_at: isoDate(form.current_period_ends_at, true),
    cancelled_at: isoDate(form.cancelled_at),
    notes: form.notes || null,
  };
  const parsed = schemas.updateSubscriptionSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message || 'Fix the billing dates before saving',
    };
  }
  return { ok: true, value: parsed.data };
}

export const GRACE_DAYS = 10;

/** The banner above the billing form. */
export function accessSummary(form: BillingForm, format: (iso: string | null) => string) {
  const accessEnd =
    form.status === 'trialing'
      ? form.trial_ends_at
      : form.current_period_ends_at || form.trial_ends_at;
  const endIso = accessEnd ? `${accessEnd}T23:59:59.999Z` : null;
  const graceEnd = endIso
    ? new Date(new Date(endIso).getTime() + GRACE_DAYS * DAY_MS).toISOString()
    : null;
  const headline =
    form.status === 'suspended' || form.status === 'cancelled'
      ? 'Locks access immediately.'
      : form.status === 'trialing'
        ? `Trial locks on ${format(endIso)}.`
        : form.status === 'active' || form.status === 'past_due'
          ? `Access locks on ${format(graceEnd)}.`
          : `Access ends ${format(endIso)}.`;
  const detail =
    form.status === 'active'
      ? 'After period end → past due (10-day grace) → expired.'
      : form.status === 'past_due'
        ? 'Grace only — never full active access.'
        : form.status === 'expired'
          ? 'Grace is over.'
          : form.status === 'trialing'
            ? 'No grace on trial.'
            : null;
  return { headline, detail, locksNow: form.status === 'suspended' || form.status === 'cancelled' };
}

// ─── Confirm wording (tenant-affecting actions) ─────────────────────────────

export interface ConfirmCopy {
  title: string;
  message: string;
  confirmLabel: string;
  tone: 'destructive' | 'default';
}

/** Statuses that cut or end a school's access. */
export const LOCKING_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
  'suspended',
  'cancelled',
  'expired',
]);

export function billingConfirm(
  schoolName: string,
  from: SubscriptionStatus | null,
  to: SubscriptionStatus,
  label: (s: SubscriptionStatus) => string,
): ConfirmCopy {
  if (LOCKING_STATUSES.has(to) && from !== to) {
    return {
      title: `${label(to)}: lock ${schoolName}?`,
      message:
        to === 'expired'
          ? `Every admin, teacher and student at ${schoolName} loses access (the grace period is over). Continue?`
          : `Every admin, teacher and student at ${schoolName} loses access immediately. Continue?`,
      confirmLabel: `Set ${label(to).toLowerCase()}`,
      tone: 'destructive',
    };
  }
  return {
    title: 'Save billing?',
    message:
      from && from !== to
        ? `Change ${schoolName} from ${label(from).toLowerCase()} to ${label(to).toLowerCase()}. This decides when the school's access locks.`
        : `Update ${schoolName}'s subscription dates and price. This decides when the school's access locks.`,
    confirmLabel: 'Save billing',
    tone: 'default',
  };
}

// ─── School form (SchoolManagement.tsx) ─────────────────────────────────────

export type EditorTab =
  | 'identity'
  | 'contact'
  | 'domains'
  | 'branding'
  | 'academic'
  | 'about'
  | 'admins'
  | 'billing'
  | 'sms';

export const EDITOR_TABS: readonly { id: EditorTab; label: string }[] = [
  { id: 'identity', label: 'Identity' },
  { id: 'contact', label: 'Contact' },
  { id: 'domains', label: 'Domains' },
  { id: 'branding', label: 'Branding' },
  { id: 'academic', label: 'Academic' },
  { id: 'about', label: 'About' },
  { id: 'admins', label: 'Admins' },
  { id: 'billing', label: 'Billing' },
  { id: 'sms', label: 'SMS' },
];

/** Billing, SMS and admins come after the school exists. */
export const CREATE_TABS: ReadonlySet<EditorTab> = new Set([
  'identity',
  'contact',
  'domains',
  'branding',
  'academic',
  'about',
]);

export const parseEditorTab = (raw: unknown): EditorTab =>
  EDITOR_TABS.find((t) => t.id === raw)?.id ?? 'identity';

export type SelectedSchool = number | 'new' | null;

export function parseSchoolParam(raw: unknown): SelectedSchool {
  if (raw === 'new') return 'new';
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export const PROMOTION_VERSION_LABELS: Record<(typeof Shared.PROMOTION_VERSIONS)[number], string> =
  {
    v1: 'v1 — Total marks (two-exam)',
  };

/** Form state: plain strings everywhere (the inputs), like the web's RHF values. */
export interface SchoolFormValues {
  name: string;
  shortName: string;
  nameBn: string;
  eiin: string;
  centerCode: string;
  schoolCode: string;
  logo: string;
  headerLogo: string;
  bannerUrls: string[];
  district: string;
  upazila: string;
  address: string;
  phone: string;
  email: string;
  establishedIn: string;
  nationalizedYear: string;
  subdomain: string;
  customDomain: string;
  resultsUrl: string;
  teacherLoginUrl: string;
  studentLoginUrl: string;
  mapEmbedUrl: string;
  gaMeasurementId: string;
  subjectGroups: string;
  medium: string;
  board: string;
  ownership: string;
  gender: string;
  promotionVersion: string;
  descriptions: { main: string; sub: string };
  academicProfile: Record<AcademicKey, string>;
}

export type SchoolTextField = Exclude<
  keyof SchoolFormValues,
  'bannerUrls' | 'descriptions' | 'academicProfile'
>;

const emptyAcademic = () =>
  Object.fromEntries(ACADEMIC_KEYS.map((k) => [k, ''])) as Record<AcademicKey, string>;

export const createEmptySchool = (year = new Date().getFullYear()): SchoolFormValues => ({
  name: '',
  shortName: '',
  nameBn: '',
  eiin: '',
  centerCode: '',
  schoolCode: '',
  logo: '',
  headerLogo: '',
  bannerUrls: [],
  district: '',
  upazila: '',
  address: '',
  phone: '',
  email: '',
  establishedIn: String(year),
  nationalizedYear: '',
  subdomain: '',
  customDomain: '',
  resultsUrl: '',
  teacherLoginUrl: '',
  studentLoginUrl: '',
  mapEmbedUrl: '',
  gaMeasurementId: '',
  subjectGroups: '',
  medium: '',
  board: '',
  ownership: '',
  gender: '',
  promotionVersion: 'v1',
  descriptions: { main: '', sub: '' },
  academicProfile: emptyAcademic(),
});

const pickEnum = (value: string | null, allowed: readonly string[]) => {
  const raw = (value ?? '').trim();
  return allowed.includes(raw) ? raw : '';
};

export function toFormValues(
  school: PlatformSchool,
  schemas: Pick<
    PlatformSchemas,
    | 'formatSubjectGroups'
    | 'SCHOOL_MEDIUMS'
    | 'SCHOOL_BOARDS'
    | 'SCHOOL_OWNERSHIPS'
    | 'SCHOOL_GENDERS'
    | 'PROMOTION_VERSIONS'
  >,
  year = new Date().getFullYear(),
): SchoolFormValues {
  return {
    name: school.name,
    shortName: school.shortName ?? '',
    nameBn: school.nameBn ?? '',
    eiin: school.eiin ?? '',
    centerCode: school.centerCode ?? '',
    schoolCode: school.schoolCode ?? '',
    logo: school.logo,
    headerLogo: school.headerLogo ?? '',
    bannerUrls: [...school.bannerUrls],
    district: school.district,
    upazila: school.upazila,
    address: school.address ?? '',
    phone: school.phone,
    email: school.email,
    establishedIn: String(school.establishedIn ?? year),
    nationalizedYear: school.nationalizedYear ?? '',
    subdomain: school.subdomain ?? '',
    customDomain: school.customDomain ?? '',
    resultsUrl: school.resultsUrl ?? '',
    teacherLoginUrl: school.teacherLoginUrl ?? '',
    studentLoginUrl: school.studentLoginUrl ?? '',
    mapEmbedUrl: school.mapEmbedUrl ?? '',
    gaMeasurementId: school.gaMeasurementId ?? '',
    subjectGroups: schemas.formatSubjectGroups(school.subjectGroups) ?? '',
    medium: pickEnum(school.medium, schemas.SCHOOL_MEDIUMS),
    board: pickEnum(school.board, schemas.SCHOOL_BOARDS),
    ownership: pickEnum(school.ownership, schemas.SCHOOL_OWNERSHIPS),
    gender: pickEnum(school.gender, schemas.SCHOOL_GENDERS),
    promotionVersion: pickEnum(school.promotionVersion, schemas.PROMOTION_VERSIONS) || 'v1',
    descriptions: { ...school.descriptions },
    academicProfile: { ...emptyAcademic(), ...school.academicProfile },
  };
}

export const FIELD_TAB: Record<string, EditorTab> = {
  name: 'identity',
  nameBn: 'identity',
  shortName: 'identity',
  eiin: 'identity',
  centerCode: 'identity',
  schoolCode: 'identity',
  establishedIn: 'identity',
  nationalizedYear: 'identity',
  initialAdmin: 'identity',
  trialEndsAt: 'identity',
  phone: 'contact',
  email: 'contact',
  district: 'contact',
  upazila: 'contact',
  address: 'contact',
  mapEmbedUrl: 'contact',
  subdomain: 'domains',
  customDomain: 'domains',
  resultsUrl: 'domains',
  teacherLoginUrl: 'domains',
  studentLoginUrl: 'domains',
  gaMeasurementId: 'domains',
  logo: 'branding',
  headerLogo: 'branding',
  bannerUrls: 'branding',
  subjectGroups: 'academic',
  medium: 'academic',
  board: 'academic',
  ownership: 'academic',
  gender: 'academic',
  promotionVersion: 'academic',
  academicProfile: 'academic',
  descriptions: 'about',
};

export const FIELD_LABELS: Record<string, string> = {
  name: 'School Name',
  nameBn: 'Bengali Name',
  shortName: 'Short Name',
  eiin: 'EIIN',
  centerCode: 'Center Code',
  schoolCode: 'School Code',
  establishedIn: 'Established In',
  nationalizedYear: 'Nationalized Year',
  phone: 'Phone',
  email: 'Email',
  district: 'District',
  upazila: 'Upazila',
  address: 'Address',
  mapEmbedUrl: 'Map Embed URL',
  subdomain: 'Subdomain',
  customDomain: 'Custom Domain',
  resultsUrl: 'Results URL',
  teacherLoginUrl: 'Teacher Login URL',
  studentLoginUrl: 'Student Login URL',
  gaMeasurementId: 'GA Measurement ID',
  logo: 'Main Logo',
  headerLogo: 'Header Logo',
  bannerUrls: 'Banners',
  subjectGroups: 'Groups',
  medium: 'Medium',
  board: 'Board',
  ownership: 'Ownership',
  gender: 'School For',
  promotionVersion: 'Promotion system version',
  'initialAdmin.username': 'Initial admin username',
  'initialAdmin.password': 'Initial admin password',
  trialEndsAt: 'Free trial ends',
  'academicProfile.grades': 'Grades',
  'academicProfile.ageRange': 'Age Range',
  'academicProfile.enrollment': 'Enrollment',
  'academicProfile.studentTeacherRatio': 'Student-Teacher Ratio',
  'academicProfile.colors': 'Uniform Colors',
  'academicProfile.campusArea': 'Campus Area',
  'academicProfile.playgroundArea': 'Playground Area',
  'descriptions.main': 'Main Description',
  'descriptions.sub': 'Sub Description',
};

export const fieldLabel = (path: string) =>
  FIELD_LABELS[path] || FIELD_LABELS[path.split('.')[0] ?? ''] || path;

export const tabForPath = (path: string): EditorTab =>
  FIELD_TAB[path] ?? FIELD_TAB[path.split('.')[0] ?? ''] ?? 'identity';

export type FieldErrors = Record<string, string>;

/** zod / server `errors: [{ path, message }]` → { 'a.b': message } (first message per path). */
export function issuesToErrors(issues: readonly unknown[]): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of issues) {
    if (typeof issue !== 'object' || issue === null) continue;
    const { path, message } = issue as { path?: unknown; message?: unknown };
    const key = Array.isArray(path) ? path.map(String).join('.') : '';
    if (!key || out[key]) continue;
    out[key] = typeof message === 'string' && message ? message : 'Invalid value';
  }
  return out;
}

/** Same pending key shape as the web while the file waits to be uploaded on save. */
export const pendingAssetKey = (kind: 'logo' | 'header', fileName: string) =>
  `pending-${kind}/${fileName.replace(/[^a-z0-9._-]+/gi, '_')}`;

/** Validate the profile form like zodResolver(updateSchoolSchema) does on the web. */
export function validateSchoolForm(
  values: SchoolFormValues,
  schemas: Pick<PlatformSchemas, 'updateSchoolSchema'>,
) {
  const parsed = schemas.updateSchoolSchema.safeParse(values);
  return parsed.success
    ? ({ ok: true, value: parsed.data } as const)
    : ({ ok: false, errors: issuesToErrors(parsed.error.issues) } as const);
}

export interface InitialAdminForm {
  username: string;
  password: string;
}

export function validateAdminForm(
  values: InitialAdminForm,
  schemas: Pick<PlatformSchemas, 'addAdminSchema'>,
) {
  const parsed = schemas.addAdminSchema.safeParse(values);
  return parsed.success
    ? ({ ok: true, value: parsed.data } as const)
    : ({ ok: false, errors: issuesToErrors(parsed.error.issues) } as const);
}

export function defaultTrialEnd(now = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

/** End of the chosen day, like the web's `${trialEndsAt}T23:59:59.999Z`. */
export const trialEndsAtIso = (ymd: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? new Date(`${ymd}T23:59:59.999Z`).toISOString() : null;

/** Profile payload after uploads: stored keys replace pending ones; banners in slot order. */
export function schoolPayload(
  parsed: Record<string, unknown>,
  uploaded: { logo: string | null; header: string | null; bannerUrls: string[] },
) {
  return {
    ...parsed,
    logo: uploaded.logo ?? parsed.logo,
    headerLogo: uploaded.header ?? parsed.headerLogo,
    bannerUrls: uploaded.bannerUrls,
  };
}

/** Domain edits move where the school's site and dashboard answer: flagged in the confirm. */
export function domainChanges(
  before: Pick<SchoolFormValues, 'subdomain' | 'customDomain'> | null,
  after: Pick<SchoolFormValues, 'subdomain' | 'customDomain'>,
): string[] {
  const norm = (v: string) => v.trim().toLowerCase();
  const changes: string[] = [];
  const pairs = [
    ['Subdomain', before?.subdomain ?? '', after.subdomain],
    ['Custom domain', before?.customDomain ?? '', after.customDomain],
  ] as const;
  for (const [label, from, to] of pairs) {
    if (norm(from) !== norm(to)) {
      changes.push(`${label}: ${norm(from) || '(none)'} → ${norm(to) || '(none)'}`);
    }
  }
  return changes;
}

export function saveSchoolConfirm(
  mode: 'create' | 'update',
  name: string,
  domainDiff: readonly string[],
  extra: { adminUsername?: string; trialEnds?: string } = {},
): ConfirmCopy {
  if (mode === 'create') {
    return {
      title: 'Create school?',
      message: `Creates the "${name}" tenant with admin "${extra.adminUsername ?? ''}" and a free trial until ${extra.trialEnds ?? ''}.${
        domainDiff.length ? ` Domains: ${domainDiff.join('; ')}.` : ''
      }`,
      confirmLabel: 'Create school',
      tone: 'default',
    };
  }
  if (domainDiff.length) {
    return {
      title: 'Change school domains?',
      message: `${domainDiff.join('; ')}. The school's site and dashboard will answer on the new address and stop answering on the old one. Continue?`,
      confirmLabel: 'Update and change domains',
      tone: 'destructive',
    };
  }
  return {
    title: 'Update school?',
    message: `Save the profile changes for "${name}". They show on the school's public site.`,
    confirmLabel: 'Update school',
    tone: 'default',
  };
}

// ─── Images (IMAGE_RULES / validateSchoolImage) ─────────────────────────────

const MB = 1024 * 1024;

export const IMAGE_RULES = {
  logo: { label: 'Logo', maxBytes: 2 * MB, minWidth: 256, maxWidth: 2048, square: true as const },
  header: {
    label: 'Header logo',
    maxBytes: 3 * MB,
    minWidth: 800,
    maxWidth: 3200,
    minHeight: 120,
    maxHeight: 900,
    minAspect: 2.5,
  },
  banner: {
    label: 'Banner',
    maxBytes: 4 * MB,
    minWidth: 1200,
    maxWidth: 3840,
    minHeight: 300,
    maxHeight: 1600,
    minAspect: 1.5,
  },
} as const;

export type ImageKind = keyof typeof IMAGE_RULES;
export const MAX_BANNERS = 12;

export const formatMb = (bytes: number) => `${(bytes / MB).toFixed(bytes % MB === 0 ? 0 : 1)} MB`;

/** Type and size, before reading dimensions. */
export function validateImageFile(
  file: { type: string; size: number },
  kind: ImageKind,
): string | null {
  const rules = IMAGE_RULES[kind];
  if (!file.type.startsWith('image/')) return `${rules.label} must be an image file (PNG or JPG)`;
  if (file.size > rules.maxBytes) {
    return `${rules.label} must be under ${formatMb(rules.maxBytes)} (got ${formatMb(file.size)})`;
  }
  return null;
}

export function validateImageDimensions(
  dims: { width: number; height: number },
  kind: ImageKind,
): string | null {
  const { width, height } = dims;
  if (!(width >= 1 && height >= 1)) return `${IMAGE_RULES[kind].label} image is invalid`;
  if (kind === 'logo') {
    const logo = IMAGE_RULES.logo;
    if (width !== height) return `${logo.label} must be square (got ${width}×${height})`;
    if (width < logo.minWidth) {
      return `${logo.label} must be at least ${logo.minWidth}×${logo.minWidth}px (got ${width}×${height})`;
    }
    if (width > logo.maxWidth) {
      return `${logo.label} must be at most ${logo.maxWidth}×${logo.maxWidth}px (got ${width}×${height})`;
    }
    return null;
  }
  const wide = IMAGE_RULES[kind];
  if (width < wide.minWidth || height < wide.minHeight) {
    return `${wide.label} must be at least ${wide.minWidth}×${wide.minHeight}px (got ${width}×${height})`;
  }
  if (width > wide.maxWidth || height > wide.maxHeight) {
    return `${wide.label} must be at most ${wide.maxWidth}×${wide.maxHeight}px (got ${width}×${height})`;
  }
  const aspect = width / height;
  if (aspect < wide.minAspect) {
    return `${wide.label} must be wide (at least ${wide.minAspect}:1, got ${aspect.toFixed(2)}:1)`;
  }
  return null;
}

/** Move one slide; saved and new slides share one order (web moveBannerTo). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length)
    return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

export type BannerSlot<F> = { kind: 'saved'; key: string } | { kind: 'pending'; file: F };

/** Saved keys (what the form validates before upload). */
export const savedBannerKeys = <F>(slots: readonly BannerSlot<F>[]) =>
  slots.flatMap((s) => (s.kind === 'saved' ? [s.key] : []));

export const pendingBannerFiles = <F>(slots: readonly BannerSlot<F>[]) =>
  slots.flatMap((s) => (s.kind === 'pending' ? [s.file] : []));

/**
 * Final carousel order after upload: each pending slot takes its uploaded key in place, so a new
 * slide moved between saved ones stays where it was put (the web appends new ones at the end).
 */
export function orderedBannerKeys<F>(slots: readonly BannerSlot<F>[], uploaded: readonly string[]) {
  let next = 0;
  const out: string[] = [];
  for (const slot of slots) {
    if (slot.kind === 'saved') out.push(slot.key);
    else {
      const key = uploaded[next++];
      if (key) out.push(key);
    }
  }
  return out;
}

// ─── Exam types (ExamTypes.tsx) ─────────────────────────────────────────────

export interface ExamTypeForm {
  name: string;
  is_year_end: boolean;
  sort_order: string;
  assign_to_new_schools: boolean;
}

export const emptyTypeForm = (): ExamTypeForm => ({
  name: '',
  is_year_end: false,
  sort_order: '0',
  assign_to_new_schools: true,
});

export const typeToForm = (t: PlatformExamType): ExamTypeForm => ({
  name: t.name,
  is_year_end: t.is_year_end,
  sort_order: String(t.sort_order),
  assign_to_new_schools: t.assign_to_new_schools,
});

export function examTypePayload(
  form: ExamTypeForm,
  schemas: Pick<PlatformSchemas, 'examTypeSchema'>,
): { ok: true; value: ExamTypeBody } | { ok: false; error: string } {
  const parsed = schemas.examTypeSchema.safeParse({
    name: form.name,
    is_year_end: form.is_year_end,
    sort_order: form.sort_order.trim() === '' ? 0 : Number(form.sort_order),
    assign_to_new_schools: form.assign_to_new_schools,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || 'Fix the form before saving' };
  }
  const { name, is_year_end, sort_order, assign_to_new_schools } = parsed.data;
  return { ok: true, value: { name, is_year_end, sort_order, assign_to_new_schools } };
}

export function typeCountBySchool(types: readonly PlatformExamType[]) {
  const counts = new Map<number, number>();
  for (const t of types) for (const id of t.school_ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

export const assignedTypeIds = (types: readonly PlatformExamType[], schoolId: number) =>
  types.filter((t) => t.school_ids.includes(schoolId)).map((t) => t.id);

export function cascadeMessage(cascade: ExamTypeCascade | null): string {
  const updated = cascade?.updated ?? 0;
  const frozen = cascade?.skipped_frozen ?? 0;
  const overlap = cascade?.skipped_overlap ?? 0;
  if (!updated && !frozen && !overlap) return 'Exam type updated';
  const bits = [`${updated} exam${updated === 1 ? '' : 's'} updated`];
  if (frozen) bits.push(`${frozen} frozen skipped`);
  if (overlap) bits.push(`${overlap} overlap skipped`);
  return bits.join('. ');
}

export const classLabel = (levels: readonly number[]) =>
  levels.length === 0 ? 'No classes' : `Class ${levels.join(', ')}`;

/** What un-assigning removes for a school (exams already created stay). */
export function schoolTypesDiff(before: readonly number[], after: readonly number[]) {
  const a = new Set(after);
  const b = new Set(before);
  return {
    added: after.filter((id) => !b.has(id)),
    removed: before.filter((id) => !a.has(id)),
  };
}

export const safeFileName = (name: string, fallback = 'school') =>
  (name || fallback).replace(/[^a-zA-Z0-9-_]/g, '_');
