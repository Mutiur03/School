import express from "express";

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
