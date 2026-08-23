import { requireSchoolId } from '@/utils/requireSchoolId.js';

/** Prefix R2 object keys with the current tenant school id. */
export const tenantR2Key = (relativePath: string): string => {
  const schoolId = requireSchoolId();
  const normalized = relativePath.replace(/^\/+/, '');
  return `${schoolId}/${normalized}`;
};
