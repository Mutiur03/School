import express from "express";
import { assertSuperAdminHostAllowed } from "@/utils/superAdminDomain.js";
import { resolveTenantHostname } from "@/utils/tenantHost.util.js";
import { prisma } from "@/config/prisma.js";
import { redis } from "@/config/redis.js";

const TENANT_SUBDOMAIN_SUFFIXES = [".localhost", ".mutiurrahman.com"] as const;
const CUSTOM_DOMAIN_PREFIXES = ["admin.", "teacher.", "student.", "www."] as const;

const normalizeTenantSubdomain = (hostname: string) =>
  hostname
    .replace(".localhost", "")
    .replace(".mutiurrahman.com", "")
    .replace(/-dashboard$/, "")
    .replace(/-school$/, "");

const isBareLocalDevHost = (hostname: string) =>
  hostname === "localhost" || hostname === "127.0.0.1";

const isPlatformSubdomainHost = (hostname: string) =>
  TENANT_SUBDOMAIN_SUFFIXES.some((suffix) => hostname.endsWith(suffix));

const customDomainCandidates = (hostname: string): string[] => {
  const candidates = new Set<string>([hostname]);
  for (const prefix of CUSTOM_DOMAIN_PREFIXES) {
    if (hostname.startsWith(prefix)) {
      candidates.add(hostname.slice(prefix.length));
    }
  }
  return [...candidates];
};

const lookupSchool = async (tenantHostname: string) => {
  if (isPlatformSubdomainHost(tenantHostname)) {
    const subdomain = normalizeTenantSubdomain(tenantHostname);
    if (subdomain) {
      return prisma.school.findUnique({ where: { subdomain } });
    }
  }

  for (const domain of customDomainCandidates(tenantHostname)) {
    const school = await prisma.school.findUnique({
      where: { customDomain: domain },
    });
    if (school) return school;
  }

  return null;
};

export const schoolContextMiddleware = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const tenantHostname = resolveTenantHostname(req);

  if (
    await assertSuperAdminHostAllowed(req)
      .then(() => true)
      .catch(() => false)
  ) {
    return next();
  }

  if (isBareLocalDevHost(tenantHostname)) {
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

  const school = await lookupSchool(tenantHostname);

  if (!school) {
    return res.status(404).json({ message: "School not found" });
  }

  await redis.set(cacheKey, JSON.stringify({ id: school.id }));
  req.schoolId = school.id;
  next();
};
