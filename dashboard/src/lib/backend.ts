const resolveBackendUrl = (): string => {
  const fromEnv = String(import.meta.env.VITE_BACKEND_URL ?? '').trim();

  if (typeof window === 'undefined') {
    return fromEnv;
  }

  // Local + tenant hosts go through the Vite proxy (empty = same origin).
  // ponytail: always '' in browser; restore URL rewrite if API ever leaves the proxy.
  return '';
};

const backend = resolveBackendUrl();
export default backend;
export const cdn = import.meta.env.VITE_CDN_URL;
export const getFileUrl = (key: string | null): string => {
  if (!key) return '';
  if (key.startsWith('http') || key.startsWith('blob:')) return key;
  if (key.startsWith('/')) return `${cdn}${key}`;
  return `${cdn}/${key}`;
};
