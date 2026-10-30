/**
 * Staff endpoints (Nest REST), verified against server/src/nest/modules/staff/staff.controller.ts
 * and dashboard/src/pages/Admin/StaffList.tsx:
 *
 *   GET    /api/staff                      optional auth; admins get full rows (anyone else the
 *          public profile); no query = every row
 *   POST   /api/staff { staff: [form] }    admin; staffFormSchema per row; returns the new rows
 *   PATCH  /api/staff/:id                  admin; staffFormSchema (partial allowed)
 *   DELETE /api/staff/:id                  admin
 *   GET    /api/staff/:id/image/upload-url?filename&contentType   admin; tenant-prefixed key
 *   PUT    /api/staff/:id/image { key }    admin; key re-checked against this school
 *   DELETE /api/staff/:id/image            admin
 *
 * The school is never sent: the server takes it from the host + token (RLS).
 */
import type { ApiClient } from './client';
import { isObj, num, objArray, str, strOrNull } from './parse';
import { uploadViaPresign, type PickedFile } from './uploads';

export interface StaffRow {
  id: number;
  name: string;
  email: string | null;
  phone: string;
  designation: string | null;
  address: string | null;
  image: string | null;
}

/** Output of staffFormSchema (optional fields are null when blank). */
export interface StaffInput {
  name: string;
  email: string | null;
  phone: string;
  designation: string | null;
  address: string | null;
}

export const STAFF_PATHS = {
  list: '/api/staff',
  one: (id: number) => `/api/staff/${id}`,
  presign: (id: number) => `/api/staff/${id}/image/upload-url`,
  image: (id: number) => `/api/staff/${id}/image`,
} as const;

export function parseStaffRow(s: Record<string, unknown>): StaffRow {
  return {
    id: num(s.id),
    name: str(s.name),
    email: strOrNull(s.email),
    phone: str(s.phone),
    designation: strOrNull(s.designation),
    address: strOrNull(s.address),
    image: strOrNull(s.image),
  };
}

export function createStaffApi(client: ApiClient) {
  return {
    async list(signal?: AbortSignal): Promise<StaffRow[]> {
      const data = await client.get<unknown>(STAFF_PATHS.list, { signal });
      return objArray(data, STAFF_PATHS.list).map(parseStaffRow);
    },
    async create(input: StaffInput): Promise<StaffRow | null> {
      const data = await client.post<unknown>(STAFF_PATHS.list, { staff: [input] });
      const first = Array.isArray(data) ? data[0] : null;
      return isObj(first) ? parseStaffRow(first) : null;
    },
    async update(id: number, input: StaffInput): Promise<void> {
      await client.patch<unknown>(STAFF_PATHS.one(id), input);
    },
    async remove(id: number): Promise<void> {
      await client.delete<unknown>(STAFF_PATHS.one(id));
    },
    /** Presign for this staff row, upload straight to storage, then save the key. */
    async uploadImage(id: number, file: PickedFile, fetchImpl?: typeof fetch): Promise<string> {
      const key = await uploadViaPresign(client, STAFF_PATHS.presign(id), file, {}, fetchImpl);
      await client.put<unknown>(STAFF_PATHS.image(id), { key });
      return key;
    },
    async removeImage(id: number): Promise<void> {
      await client.delete<unknown>(STAFF_PATHS.image(id));
    },
  };
}

export type StaffApi = ReturnType<typeof createStaffApi>;
