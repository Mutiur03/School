import { getRlsContext } from '@/config/rlsContextStore.js';
import { ApiError } from '@/utils/ApiError.js';

export const requireSchoolId = (): number => {
  const schoolId = getRlsContext()?.schoolId;
  if (!Number.isInteger(schoolId)) {
    throw new ApiError(400, 'School context is required');
  }
  return schoolId as number;
};
