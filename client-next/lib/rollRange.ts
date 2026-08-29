/** Parses a settings roll-range string (e.g. "1-30,35") into zero-padded roll numbers. */
export function parseRollRange(rollRange: string | null | undefined): string[] {
  if (!rollRange) return [];
  const rolls: Set<number> = new Set();
  const parts = rollRange.split(',').map((p) => p.trim());
  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1]);
      const end = parseInt(rangeMatch[2]);
      for (let i = start; i <= end; i++) {
        rolls.add(i);
      }
    } else {
      const num = parseInt(part);
      if (!isNaN(num)) {
        rolls.add(num);
      }
    }
  }
  return Array.from(rolls)
    .sort((a, b) => a - b)
    .map((num) => String(num).padStart(2, '0'));
}
