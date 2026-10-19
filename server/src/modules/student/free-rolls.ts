type Slot = { year: number; class: number; section: string; roll: number };

const slotKey = (s: Slot) => `${s.year}|${s.class}|${s.section}`;

/**
 * Final roll per imported row: a free file roll stays; one already taken (or repeated in the file)
 * moves after the highest roll in its year+class+section. Nobody already enrolled moves.
 */
export function freeRolls(rows: Slot[], taken: Slot[]) {
  const used = new Set(taken.map((t) => `${slotKey(t)}|${t.roll}`));
  const max = new Map<string, number>();
  for (const s of [...taken, ...rows])
    max.set(slotKey(s), Math.max(max.get(slotKey(s)) ?? 0, s.roll));
  return rows.map((r) => {
    const key = slotKey(r);
    let roll = r.roll;
    if (used.has(`${key}|${roll}`)) {
      roll = max.get(key)! + 1;
      max.set(key, roll);
    }
    used.add(`${key}|${roll}`);
    return roll;
  });
}
