/** Attach an object key only after a successful new upload (never echo DB-held paths). */
export function withUploadedKey<T extends Record<string, unknown>>(
  body: T,
  field: string,
  uploadedKey: string | undefined,
): T {
  if (!uploadedKey) return body;
  return { ...body, [field]: uploadedKey };
}

/** Remove a field so metadata-only edits do not re-post stored paths. */
export function withoutField<T extends Record<string, unknown>, K extends keyof T>(
  body: T,
  field: K,
): Omit<T, K> {
  const { [field]: _removed, ...rest } = body;
  return rest;
}
