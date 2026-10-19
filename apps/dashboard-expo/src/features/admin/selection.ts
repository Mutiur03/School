/** Row selection for list pages with bulk actions (web StudentList / TeacherList). */

export const toggleId = (set: ReadonlySet<number>, id: number): Set<number> => {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

/** Header checkbox: all visible selected → clear them; otherwise add them all. */
export function togglePage(set: ReadonlySet<number>, visible: readonly number[]): Set<number> {
  const next = new Set(set);
  const all = visible.length > 0 && visible.every((id) => next.has(id));
  for (const id of visible) {
    if (all) next.delete(id);
    else next.add(id);
  }
  return next;
}

export const pageState = (set: ReadonlySet<number>, visible: readonly number[]) => {
  const on = visible.filter((id) => set.has(id)).length;
  return { all: visible.length > 0 && on === visible.length, some: on > 0 && on < visible.length };
};

/** Keep only ids still present (the web drops selections that left the list). */
export const retainIds = (set: ReadonlySet<number>, present: readonly number[]): Set<number> => {
  const keep = new Set(present);
  return new Set([...set].filter((id) => keep.has(id)));
};

export const sameIds = (a: ReadonlySet<number>, b: ReadonlySet<number>) =>
  a.size === b.size && [...a].every((id) => b.has(id));
