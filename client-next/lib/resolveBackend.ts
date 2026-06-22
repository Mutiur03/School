const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const TENANT_CLIENT_HOST_SUFFIX =
  process.env.NEXT_PUBLIC_TENANT_CLIENT_HOST_SUFFIX ||
  "-school.mutiurrahman.com";

export function isLocalDevHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "localhost" || host.endsWith(".localhost");
}

export function isTenantHost(hostname: string): boolean {
  return hostname.toLowerCase().endsWith(TENANT_CLIENT_HOST_SUFFIX);
}

/** Empty string = same-origin `/api` (tenant router or dev proxy). */
export function resolveBackendUrlFromHost(
  hostname: string,
  envUrl = process.env.NEXT_PUBLIC_BACKEND_URL,
): string {
  const fromEnv = trimTrailingSlash(String(envUrl ?? "").trim());
  const host = hostname.toLowerCase();

  if (isLocalDevHost(host) || isTenantHost(host)) {
    return "";
  }

  return fromEnv;
}

/** Absolute base URL for server-side fetch. */
export function resolveBackendBaseUrl(
  hostname: string,
  protocol: string,
  envUrl = process.env.NEXT_PUBLIC_BACKEND_URL,
): string {
  const envBackend = resolveBackendUrlFromHost(hostname, envUrl);
  if (envBackend) return envBackend;
  if (!hostname) return "";
  return trimTrailingSlash(`${protocol}://${hostname}`);
}

export function resolveClientAxiosBaseUrl(): string {
  if (typeof window === "undefined") {
    return trimTrailingSlash(String(process.env.NEXT_PUBLIC_BACKEND_URL ?? "").trim());
  }

  return resolveBackendUrlFromHost(window.location.hostname);
}
