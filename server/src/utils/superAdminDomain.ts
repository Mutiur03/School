import { resolveTenantHostname } from '@/utils/tenantHost.util.js';
import { ApiError } from '@/utils/ApiError.js';
import { Request } from 'express';

const SUPER_ADMIN_HOSTS = new Set(['admin.localhost', 'superadmin.mutiurrahman.com']);

export const assertSuperAdminHostAllowed = async (req: Request) => {
  const lowerHostname = resolveTenantHostname(req).toLowerCase();
  if (!SUPER_ADMIN_HOSTS.has(lowerHostname)) {
    throw new ApiError(403, 'Access denied: Invalid host for super admin');
  }
  return true;
};
