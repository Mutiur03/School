import { Request } from "express";

export const assertSuperAdminHostAllowed = async (req: Request) => {
  const lowerHostname = hostName(req).toLowerCase();
  if (
    !["admin.localhost", "superadmin.mutiurrahman.com"].includes(lowerHostname)
  ) {
    throw new Error("Access denied: Invalid host for super admin");
  }
  return true;
};

export const hostName = (req: Request): string => {
  const origin = req.headers.origin;

  if (typeof origin === "string" && origin.trim() !== "") {
    try {
      return new URL(origin).hostname.toLowerCase();
    } catch {
      // Ignore malformed origin, fallback to actual API host.
    }
  }

  return req.hostname.toLowerCase();
};
