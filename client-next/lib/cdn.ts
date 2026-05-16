/**
 * Client-safe utilities for resolving file/CDN URLs.
 * No server-only imports — safe to use in "use client" components.
 */

export const cdn = process.env.NEXT_PUBLIC_CDN_URL;

/**
 * Convert an R2 key or legacy Cloudinary URL into a fully-qualified URL.
 * - Full URLs (http/https, blob:) are returned as-is.
 * - Bare R2 keys are prefixed with NEXT_PUBLIC_CDN_URL.
 */
export const getFileUrl = (key: string | null | undefined): string => {
  if (!key) return "";
  if (key.startsWith("http") || key.startsWith("blob:")) return key;
  if (key.startsWith("/")) return `${cdn}${key}`;
  return `${cdn}/${key}`;
};
