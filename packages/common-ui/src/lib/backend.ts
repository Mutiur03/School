const resolveBackendUrl = (): string => {
  const fromEnv = String(import.meta.env?.VITE_BACKEND_URL ?? "").trim();

  if (typeof window === "undefined") {
    return fromEnv;
  }

  const currentHost = window.location.hostname.toLowerCase();

  if (currentHost === "localhost" || currentHost.endsWith(".localhost")) {
    return `${window.location.protocol}//${currentHost}:3002`;
  }

  if (
    currentHost.endsWith("-school.mutiurrahman.com") ||
    currentHost.endsWith("-dashboard.mutiurrahman.com")
  ) {
    return "";
  }

  return fromEnv;
};

const backend = resolveBackendUrl();
export default backend;
export const cdn = import.meta.env?.VITE_CDN_URL;
export const getFileUrl = (key: string | null): string => {
  if (!key) return "";
  if (key.startsWith("http") || key.startsWith("blob:")) return key;
  if (key.startsWith("/")) return `${cdn}${key}`;
  return `${cdn}/${key}`;
};
