import { getRlsContext } from '@/config/rlsContextStore.js';
import { assertVerifiedTenantSchoolId } from '@/middlewares/access.middleware.js';

export const requireSchoolId = (): number => {
  return assertVerifiedTenantSchoolId(getRlsContext()?.schoolId);
};
