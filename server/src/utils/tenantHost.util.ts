import express from "express";

const MULTI_PART_PUBLIC_SUFFIXES = [
  ".gov.bd",
  ".com.bd",
  ".edu.bd",
  ".org.bd",
  ".net.bd",
  ".co.uk",
  ".com.au",
] as const;

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

/** Apex / registrable domain — ignores subdomains like www, testv, teacher. */
export const getMainDomain = (hostname: string): string => {
  const host = hostname.toLowerCase().replace(/:\d+$/, "").trim();
  if (!host) return host;

  for (const suffix of MULTI_PART_PUBLIC_SUFFIXES) {
    if (!host.endsWith(suffix)) continue;

    const withoutSuffix = host.slice(0, -suffix.length);
    const labels = withoutSuffix.split(".").filter(Boolean);
    const registrableLabel = labels[labels.length - 1];
    if (!registrableLabel) return host;
    return `${registrableLabel}${suffix}`;
  }

  const labels = host.split(".").filter(Boolean);
  if (labels.length <= 2) return host;
  return labels.slice(-2).join(".");
};

/** Hostnames to match against School.customDomain (main domain first). */
export const getCustomDomainLookupCandidates = (hostname: string): string[] => {
  const host = hostname.toLowerCase().replace(/:\d+$/, "");
  const main = getMainDomain(host);
  return [...new Set([main, host, `www.${main}`])];
};

export const resolveTenantHostname = (
  req: express.Request,
  fallbackHostname?: string,
): string => {
  const fallback =
    fallbackHostname ??
    (typeof req.hostname === "string" ? req.hostname.toLowerCase() : "localhost");

  return (
    requestHostname(req.headers.origin) ??
    requestHostname(req.headers["x-tenant-host"]) ??
    requestHostname(req.headers["x-forwarded-host"]) ??
    requestHostname(req.headers.referer) ??
    requestHostname(req.headers.referrer) ??
    fallback
  );
};
