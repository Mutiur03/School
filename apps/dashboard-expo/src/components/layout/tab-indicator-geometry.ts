/** Shared geometry for the bottom-tab pill: 56x32, 8px from the top (the tab's `pt-2`). */
export const PILL = { top: 8, width: 56, height: 32 } as const;

export interface IndicatorProps {
  index: number;
  count: number;
  /** Width of the row of equal-width (flex-1) tabs. */
  width: number;
}

/** Left offset that centres the pill under tab `index`. */
export function pillX(index: number, count: number, width: number): number {
  const tabWidth = width / count;
  return index * tabWidth + (tabWidth - PILL.width) / 2;
}
