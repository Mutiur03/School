/** Same family name as dashboard/src/index.css MixedFont Bangla face. */
export const BANGLA_FONT = 'SolaimanLipi';

/** CSS font stacks work on web; React Native treats the whole string as one family name. */
export function latinWithBangla(latinFamily: string, platform: string): string {
  return platform === 'web' ? `${latinFamily}, ${BANGLA_FONT}` : latinFamily;
}

/** Split MixedFont-style: Bangla (U+0980–U+09FF) vs everything else. */
export function scriptRuns(text: string): { bangla: boolean; text: string }[] {
  const out: { bangla: boolean; text: string }[] = [];
  const re = /[\u0980-\u09FF]+/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    if (start > last) out.push({ bangla: false, text: text.slice(last, start) });
    out.push({ bangla: true, text: m[0] });
    last = start + m[0].length;
  }
  if (last < text.length) out.push({ bangla: false, text: text.slice(last) });
  return out.length > 0 ? out : [{ bangla: false, text }];
}
