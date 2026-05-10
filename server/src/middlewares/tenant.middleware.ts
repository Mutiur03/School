import express from "express";
import {
  hostName,
  assertSuperAdminHostAllowed,
} from "@/utils/superAdminDomain.js";
import { prisma } from "@/config/prisma.js";
import { redis } from "@/config/redis.js";

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
  requestHostname(req.headers.referer) ??
  requestHostname(req.headers.referrer) ??
  fallbackHostname;

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
  const cached = await redis.get(tenantHostname);
  if (cached) {
    const parsedCached = JSON.parse(cached) as { id?: number };
    if (parsedCached?.id) {
      req.schoolId = parsedCached.id;
      return next();
    }
  }
  const isSubdomain =
    tenantHostname.endsWith(".localhost") ||
    tenantHostname.endsWith(".mutiurrahman.com");
  const school = isSubdomain
    ? await prisma.school.findUnique({
        where: {
          subdomain: normalizeTenantSubdomain(tenantHostname),
        },
      })
    : await prisma.school.findUnique({
        where: { customDomain: getRootDomain(tenantHostname) },
      });

  if (!school) {
    return res.status(404).json({ message: "School not found" });
  }
  await redis.set(tenantHostname, JSON.stringify({ id: school.id }));
  req.schoolId = school.id;
  next();
};

// Gets root domain, ignoring subdomains
// "student.lbphs.gov.bd" → "lbphs.gov.bd"
// "lbphs.gov.bd" → "lbphs.gov.bd"
// "school1.mutiurrahman.com" → handled by isSubdomain check, not this
const getRootDomain = (hostname: string): string => {
  const parts = hostname.split('.');
  // Handle country-code second-level domains like .gov.bd, .edu.bd, .co.uk
  const ccSLDs = ['gov', 'edu', 'co', 'org', 'net', 'ac'];
  
  if (parts.length >= 3 && ccSLDs.includes(parts[parts.length - 2])) {
    // e.g. student.lbphs.gov.bd → last 3 parts = lbphs.gov.bd
    return parts.slice(-3).join('.');
  }
  
  // Regular domain: student.lbphs.com → last 2 parts = lbphs.com
  return parts.slice(-2).join('.');
};
