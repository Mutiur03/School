/** True when the href should open in a new tab (absolute external URL). */
export function isExternalHref(href?: string | null): boolean {
  if (!href) return false;
  return /^(https?:|mailto:|tel:|\/\/)/i.test(href.trim());
}
