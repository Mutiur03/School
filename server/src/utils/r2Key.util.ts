import { deleteFromR2, getUploadUrl } from '@/config/r2.js';
import { ApiError } from '@/utils/ApiError.js';
import { requireSchoolId } from '@/utils/requireSchoolId.js';

/** Prefix R2 object keys with the current tenant school id. */
export const tenantR2Key = (relativePath: string): string => {
  const schoolId = requireSchoolId();
  const normalized = relativePath.replace(/^\/+/, '');
  return `${schoolId}/${normalized}`;
};

/** Reject client-supplied object keys outside the current tenant prefix. */
export const assertTenantR2Key = (key: string): void => {
  const schoolId = requireSchoolId();
  const prefix = `${schoolId}/`;
  if (typeof key !== 'string' || !key.startsWith(prefix)) {
    throw new ApiError(403, 'Invalid storage key for this school');
  }
};

export const assertTenantR2KeyIfPresent = (key: string | null | undefined): void => {
  if (key) assertTenantR2Key(key);
};

/** Presign a PUT for `{schoolId}/{folder}/{timestamp}-{filename}`. */
export async function presignTenantUpload(folder: string, filename: string, contentType: string) {
  const key = tenantR2Key(`${folder}/${Date.now()}-${filename}`);
  const uploadUrl = await getUploadUrl(key, contentType);
  return { uploadUrl, key };
}

/** Standard PDF document URL columns (syllabus, class-routine, …). */
export const pdfDocFields = (key: string) => ({
  pdf_url: key,
  download_url: key,
  public_id: key,
});

/** Same shape with `file` instead of `pdf_url` (notice, citizen-charter). */
export const fileDocFields = (key: string) => ({
  file: key,
  download_url: key,
  public_id: key,
});

/** Row-backed keys may predate `{schoolId}/` prefixes; delete without blocking the update. */
async function deleteStoredR2KeyBestEffort(key: string): Promise<void> {
  try {
    await deleteFromR2(key);
  } catch {
    // ponytail: missing object or transient R2 failure must not roll back DB writes
  }
}

/** Delete old object when replacing with a different key. */
export async function swapR2Key(oldPublicId: string | null | undefined, newKey: string) {
  assertTenantR2Key(newKey);
  if (oldPublicId && oldPublicId !== newKey) {
    await deleteStoredR2KeyBestEffort(oldPublicId);
  }
}

export async function deleteFromR2IfPresent(publicId: string | null | undefined) {
  if (publicId) {
    await deleteStoredR2KeyBestEffort(publicId);
  }
}

export const assertTenantR2Keys = (keys: string[]): void => {
  for (const key of keys) {
    assertTenantR2Key(key);
  }
};
