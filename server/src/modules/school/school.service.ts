import { prisma } from "../../config/prisma.js";
import { Prisma } from "@prisma/client";

const normalizeHost = (rawHost: string): string =>
  rawHost.toLowerCase().trim().replace(/:\d+$/, "").replace(/\.$/, "");

const normalizeSubdomainValue = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalizeHost(value).replace(/^\.+|\.+$/g, "");
  if (!normalized) {
    return null;
  }

  if (normalized.endsWith(".localhost")) {
    const localParts = normalized.split(".").filter(Boolean);
    if (localParts.length > 1) {
      return localParts.slice(0, -1).join(".");
    }
  }

  const parts = normalized.split(".").filter(Boolean);
  if (parts.length >= 3) {
    return parts.slice(0, -2).join(".");
  }

  return normalized;
};

const normalizeCustomDomainValue = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const raw = value.trim();
  if (!raw) {
    return null;
  }

  try {
    const host = new URL(raw.includes("://") ? raw : `http://${raw}`).hostname;
    return normalizeHost(host);
  } catch {
    const hostOnly = raw.split("/")[0] ?? "";
    const normalized = normalizeHost(hostOnly);
    return normalized || null;
  }
};

const normalizeSchoolPayload = (data: any) => {
  const payload = { ...data };

  if (Object.prototype.hasOwnProperty.call(payload, "subdomain")) {
    payload.subdomain = normalizeSubdomainValue(payload.subdomain);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "customDomain")) {
    payload.customDomain = normalizeCustomDomainValue(payload.customDomain);
  }

  return payload;
};

const getSubdomainCandidates = (hostname: string): string[] => {
  const host = normalizeHost(hostname);
  const parts = host.split(".").filter(Boolean);

  if (parts.length <= 1) {
    return [];
  }

  // local development hostnames, e.g. lbp.localhost
  if (parts[parts.length - 1] === "localhost") {
    return parts
      .slice(0, -1)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  // regular domains, e.g. lbp.example.com -> ["lbp"]
  // multi-level subdomains, e.g. a.b.example.com -> ["a", "b"]
  if (parts.length >= 3) {
    return parts
      .slice(0, -2)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return [];
};

export class SchoolService {
  static async createSchool(data: any) {
    const payload = normalizeSchoolPayload(data);
    return prisma.school.create({
      data: payload,
    });
  }

  static async getSchools() {
    return prisma.school.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  static async getSchoolById(id: number) {
    return prisma.school.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            students: true,
            teachers: true,
            exams: true,
            notices: true,
          },
        },
      },
    });
  }

  static async updateSchool(id: number, data: any) {
    const payload = normalizeSchoolPayload(data);
    return prisma.school.update({
      where: { id },
      data: payload,
    });
  }

  static async deleteSchool(id: number) {
    return prisma.school.delete({
      where: { id },
    });
  }

  static async getSchoolInfo(id: number) {
    return prisma.school.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        shortName: true,
        logo: true,
        favicon: true,
        district: true,
        upazila: true,
        phone: true,
        email: true,
        website: true,
        slogan: true,
        establishedIn: true,
      },
    });
  }

  static async getCurrentSchoolInfo({
    schoolId,
    hostname,
  }: {
    schoolId?: number;
    hostname?: string;
  }) {
    if (schoolId) {
      const schoolById = await this.getSchoolInfo(schoolId);
      if (schoolById) return schoolById;
    }

    if (hostname) {
      const schoolByDomain = await this.getSchoolByDomain(hostname);
      if (schoolByDomain) {
        return this.getSchoolInfo(schoolByDomain.id);
      }
    }

    // Dev/local fallback so public config still works when domain mapping is absent.
    return prisma.school.findFirst({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        shortName: true,
        logo: true,
        favicon: true,
        district: true,
        upazila: true,
        phone: true,
        email: true,
        website: true,
        slogan: true,
        establishedIn: true,
      },
    });
  }

  static async getSchoolByDomain(hostname: string) {
    const normalizedHost = normalizeHost(hostname);

    // 1. Check exact custom domain and common www alias.
    const customCandidates = Array.from(
      new Set([
        normalizedHost,
        normalizedHost.startsWith("www.")
          ? normalizedHost.slice(4)
          : `www.${normalizedHost}`,
      ]),
    );

    const normalizedCustomCandidates = customCandidates.map((candidate) =>
      normalizeHost(candidate),
    );

    const schoolByCustomDomainRows = await prisma.$queryRaw<
      Array<{ id: number }>
    >(
      Prisma.sql`
        SELECT id
        FROM "School"
        WHERE "customDomain" IS NOT NULL
          AND lower("customDomain") IN (${Prisma.join(normalizedCustomCandidates)})
        LIMIT 1
      `,
    );

    if (schoolByCustomDomainRows.length > 0) {
      return prisma.school.findUnique({
        where: { id: schoolByCustomDomainRows[0].id },
      });
    }

    const schoolByDomainTableRows = await prisma.$queryRaw<
      Array<{ school_id: number }>
    >(
      Prisma.sql`
        SELECT school_id
        FROM school_domains
        WHERE lower(host) IN (${Prisma.join(normalizedCustomCandidates)})
        LIMIT 1
      `,
    );

    if (schoolByDomainTableRows.length > 0) {
      return prisma.school.findUnique({
        where: { id: schoolByDomainTableRows[0].school_id },
      });
    }

    // 2. Resolve by subdomain candidates.
    const subdomainCandidates = getSubdomainCandidates(normalizedHost);
    if (subdomainCandidates.length === 0) {
      return null;
    }

    const normalizedSubdomainCandidates = Array.from(
      new Set([
        ...subdomainCandidates,
        normalizedHost,
        ...subdomainCandidates
          .map((candidate) => normalizeSubdomainValue(candidate))
          .filter((candidate): candidate is string => Boolean(candidate)),
      ]),
    );

    if (normalizedSubdomainCandidates.length === 0) {
      return null;
    }

    const schoolBySubdomainRows = await prisma.$queryRaw<Array<{ id: number }>>(
      Prisma.sql`
        SELECT id
        FROM "School"
        WHERE "subdomain" IS NOT NULL
          AND lower("subdomain") IN (${Prisma.join(normalizedSubdomainCandidates)})
        LIMIT 1
      `,
    );

    if (schoolBySubdomainRows.length > 0) {
      return prisma.school.findUnique({
        where: { id: schoolBySubdomainRows[0].id },
      });
    }

    const schoolBySubdomainDomainTableRows = await prisma.$queryRaw<
      Array<{ school_id: number }>
    >(
      Prisma.sql`
        SELECT school_id
        FROM school_domains
        WHERE kind = 'SUBDOMAIN'
          AND lower(host) IN (${Prisma.join(normalizedSubdomainCandidates)})
        LIMIT 1
      `,
    );

    if (schoolBySubdomainDomainTableRows.length > 0) {
      return prisma.school.findUnique({
        where: { id: schoolBySubdomainDomainTableRows[0].school_id },
      });
    }

    return null;
  }

  static async isAllowedSuperAdminHost(hostname: string) {
    const normalizedHost = normalizeHost(hostname);
    if (!normalizedHost) {
      return false;
    }

    const hostCandidates = [normalizedHost];

    const normalizedCandidates = hostCandidates.map((host) =>
      host.toLowerCase(),
    );
    console.log(hostname, normalizedCandidates);

    try {
      const rows = await prisma.superAdminHost.findMany({
        where: {
          host: {
            in: normalizedCandidates,
          },
        },
        select: { id: true },
        take: 1,
      });
      console.log(rows);

      return rows.length > 0;
    } catch (error) {
      // Fail closed: if allowlist table is missing/misconfigured, block superadmin host access.
      console.error("Failed to validate super admin host allowlist:", error);
      return false;
    }
  }
}
