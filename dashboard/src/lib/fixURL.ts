import backend from "./backend";

export function fixURL(url: string): string {
  const host = backend;
  return host + "/" + url.replace(/\\/g, "/");
}
