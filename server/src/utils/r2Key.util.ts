import { deleteFromR2, getUploadUrl } from '@/config/r2.js';
import { requireSchoolId } from '@/utils/requireSchoolId.js';

/** Prefix R2 object keys with the current tenant school id. */
export const tenantR2Key = (relativePath: string): string => {
  const schoolId = requireSchoolId();
  const normalized = relativePath.replace(/^\/+/, '');
  return `${schoolId}/${normalized}`;
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

/** Delete old object when replacing with a different key. */
export async function swapR2Key(oldPublicId: string | null | undefined, newKey: string) {
  if (oldPublicId && oldPublicId !== newKey) await deleteFromR2(oldPublicId);
}

export async function deleteFromR2IfPresent(publicId: string | null | undefined) {
  if (publicId) await deleteFromR2(publicId);
}
