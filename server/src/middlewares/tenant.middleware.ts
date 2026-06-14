import express from "express";
import {
  hostName,
  assertSuperAdminHostAllowed,
} from "@/utils/superAdminDomain.js";
import { prisma } from "@/config/prisma.js";
import { redis } from "@/config/redis.js";

const TENANT_SUBDOMAIN_SUFFIXES = [".localhost", ".mutiurrahman.com"] as const;

const normalizeTenantSubdomain = (hostname: string) =>
  hostname
    .replace(".localhost", "")
    .replace(".mutiurrahman.com", "")
    .replace(/-dashboard$/, "")
    .replace(/-school$/, "");

const requestHostname = (value: unknown): string | null => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || raw.trim() === "") return null;

  try {
    const parsed = raw.includes("://") ? new URL(raw).hostname : raw;
    const hostname = parsed.toLowerCase().replace(/:\d+$/, "");
    if (!/^[a-z0-9.-]+$/.test(hostname)) return null;
    return hostname;
  } catch {
    return null;
  }
};

const tenantHostName = (req: express.Request, fallbackHostname: string) =>
  requestHostname(req.headers.origin) ??
  requestHostname(req.headers["x-tenant-host"]) ??
  requestHostname(req.headers["x-forwarded-host"]) ??
  requestHostname(req.headers.referer) ??
  requestHostname(req.headers.referrer) ??
  fallbackHostname;

const isBareLocalDevHost = (hostname: string) =>
  hostname === "localhost" || hostname === "127.0.0.1";

const isTenantSubdomainHost = (hostname: string) =>
  TENANT_SUBDOMAIN_SUFFIXES.some((suffix) => hostname.endsWith(suffix));

export const schoolContextMiddleware = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const hostname = hostName(req);
  const tenantHostname = tenantHostName(req, hostname);

  if (
    await assertSuperAdminHostAllowed(req)
      .then(() => true)
      .catch(() => false)
  ) {
    return next();
  }

  if (isBareLocalDevHost(tenantHostname) || !isTenantSubdomainHost(tenantHostname)) {
    return res.status(404).json({
      message:
        "School not found. Use a school subdomain (e.g. yourschool.localhost).",
    });
  }

  const subdomain = normalizeTenantSubdomain(tenantHostname);
  if (!subdomain) {
    return res.status(404).json({
      message:
        "School not found. Use a school subdomain (e.g. yourschool.localhost).",
    });
  }

  const cacheKey = `tenant:${tenantHostname}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    const parsedCached = JSON.parse(cached) as { id?: number };
    if (parsedCached?.id) {
      req.schoolId = parsedCached.id;
      return next();
    }
  }

  const school = await prisma.school.findUnique({
    where: { subdomain },
  });

  if (!school) {
    return res.status(404).json({ message: "School not found" });
  }

  await redis.set(cacheKey, JSON.stringify({ id: school.id }));
  req.schoolId = school.id;
  next();
};
