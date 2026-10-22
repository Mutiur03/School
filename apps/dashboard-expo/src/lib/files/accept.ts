/** True when `file` matches an `accept` list like "application/pdf,.pdf" or "image/*". */
export function matchesAccept(file: { name: string; type: string }, accept: string): boolean {
  const parts = accept
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  if (parts.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return parts.some((p) =>
    p.startsWith('.')
      ? name.endsWith(p)
      : p.endsWith('/*')
        ? type.startsWith(p.slice(0, -1))
        : type === p,
  );
}
