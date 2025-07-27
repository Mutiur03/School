export function fixURL(url: string): string {
  const host = process.env.NEXT_PUBLIC_API_URL;
  return host + "/" + url.replace(/\\/g, "/");
}
