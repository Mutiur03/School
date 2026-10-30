/**
 * GET /api/school — server/src/nest/modules/school.
 * Public (no auth). The school is resolved from the request host by the tenant middleware, so
 * the caller never passes a school id. `{ success, data }`; the payload is the `select` in
 * SchoolService.getSchoolInfo. Only the fields the dashboard needs are typed; the response
 * contains more (address, seo, descriptions, ...).
 *
 * `logo` / `headerLogo` are R2 keys (or absolute URLs) resolved against the public CDN, exactly
 * like getFileUrl() in dashboard/src/lib/backend.ts and client-next/lib/cdn.ts.
 */
import type { ApiClient } from './client';

export interface PublicSchoolInfo {
  id: number;
  name: string;
  shortName: string | null;
  nameBn: string | null;
  logo: string | null;
  headerLogo: string | null;
  subdomain: string | null;
  customDomain: string | null;
  district: string | null;
  upazila: string | null;
}

export const SCHOOL_PATHS = {
  publicInfo: '/api/school',
} as const;

export function createSchoolApi(client: ApiClient) {
  return {
    getPublicInfo: (signal?: AbortSignal) =>
      client.get<PublicSchoolInfo>(SCHOOL_PATHS.publicInfo, { auth: false, signal }),
  };
}

export type SchoolApi = ReturnType<typeof createSchoolApi>;
