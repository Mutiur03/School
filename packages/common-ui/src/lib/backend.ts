const backend = String(import.meta.env?.VITE_BACKEND_URL ?? "").trim();
export default backend;
export const cdn = import.meta.env?.VITE_CDN_URL;
export const getFileUrl = (key: string | null): string => {
  if (!key) return "";
  if (key.startsWith("http") || key.startsWith("blob:")) return key;
  if (key.startsWith("/")) return `${cdn}${key}`;
  return `${cdn}/${key}`;
};
