/** Pure helpers behind MultiSelect (kept apart so node tests can load them). */
export interface MultiOption<T extends string | number> {
  value: T;
  label: string;
}

/** Adds or removes `value`, keeping the options' order. */
export function toggleValue<T extends string | number>(
  selected: readonly T[],
  value: T,
  options: readonly MultiOption<T>[],
): T[] {
  const next = new Set(selected);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  const order = options.map((o) => o.value);
  return [...next].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

/** Trigger text: "All …" when nothing is picked, the label for one, "N selected" otherwise. */
export function multiLabel<T extends string | number>(
  selected: readonly T[],
  options: readonly MultiOption<T>[],
  allLabel: string,
): string {
  const known = selected.filter((v) => options.some((o) => o.value === v));
  if (known.length === 0) return allLabel;
  if (known.length === 1) return options.find((o) => o.value === known[0])?.label ?? allLabel;
  return `${known.length} selected`;
}

/** Row filter: an empty selection matches everything. */
export const matchesAny = <T extends string | number>(selected: readonly T[], value: T) =>
  selected.length === 0 || selected.includes(value);
