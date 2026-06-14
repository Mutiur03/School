import { Request } from "express";
import { resolveTenantHostname } from "@/utils/tenantHost.util.js";

const SUPER_ADMIN_HOSTS = new Set([
  "admin.localhost",
  "superadmin.mutiurrahman.com",
]);

export const hostName = (req: Request): string => resolveTenantHostname(req);

export const assertSuperAdminHostAllowed = async (req: Request) => {
  const lowerHostname = resolveTenantHostname(req).toLowerCase();
  if (!SUPER_ADMIN_HOSTS.has(lowerHostname)) {
    throw new Error("Access denied: Invalid host for super admin");
  }
  return true;
};
