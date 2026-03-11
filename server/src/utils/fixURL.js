export const fixUrl = (url) => {
  if (!url) return "";
  return url.replace(/\\/g, "/");
};
