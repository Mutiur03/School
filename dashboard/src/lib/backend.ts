const resolveBackendUrl = (): string => {
  const fromEnv = String(import.meta.env.VITE_BACKEND_URL ?? "").trim();

  if (typeof window === "undefined") {
    return fromEnv;
  }

  // Local fallback for development if no env is provided.
  if (!fromEnv) {
    if (
      window.location.hostname === "localhost" ||
      window.location.hostname.endsWith(".localhost")
    ) {
      return `${window.location.protocol}//${window.location.hostname}:3002`;
    }

    return "";
  }

  try {
    const parsed = new URL(fromEnv);
    const currentHost = window.location.hostname;
    const isLocalBackend =
      parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    const isTenantLocalhost = currentHost.endsWith(".localhost");

    // Keep tenant host (e.g. lbp.localhost) so cookies are first-party on refresh.
    if (isLocalBackend && isTenantLocalhost) {
      parsed.hostname = currentHost;
    }

    return parsed.toString().replace(/\/$/, "");
  } catch {
    return fromEnv;
  }
};

const backend = resolveBackendUrl();
export default backend;
export const cdn = import.meta.env.VITE_CDN_URL;
export const getFileUrl = (key: string | null): string => {
  if (!key) return "";
  if (key.startsWith("http") || key.startsWith("blob:")) return key;
  if (key.startsWith("/")) return `${cdn}${key}`;
  return `${cdn}/${key}`;
};
