/**
 * Step for 4 intervals: the smallest 1 / 2 / 2.5 / 5 / 10 x 10^n that covers the data maximum,
 * whole numbers only (counts; the web chart uses allowDecimals={false}).
 */
export function niceStep(max: number) {
  if (max <= 0) return 1;
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const nice = [1, 2, 2.5, 5, 10].find((c) => c * pow >= raw) ?? 10;
  return Math.max(1, Math.ceil(nice * pow));
}
