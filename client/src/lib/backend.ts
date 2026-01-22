const backend = import.meta.env.VITE_BACKEND_URL;
export default backend;
const cdn = import.meta.env.VITE_CDN_URL;
const getFileUrl = (key: string | null): string => {
  if (!key) return "";
  if (key.startsWith("http") || key.startsWith("blob:")) return key;
  if (key.startsWith("/")) return `${cdn}${key}`;
  return `${cdn}/${key}`;
};
export { getFileUrl };
