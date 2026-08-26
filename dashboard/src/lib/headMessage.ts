/** Split Bangla/English head message into readable paragraphs.
 * Keep in sync with client-next/lib/headMessage.ts
 */
export function toParagraphs(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (/\n\s*\n/.test(trimmed)) {
    return trimmed
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  const sentences = trimmed
    .split(/(?<=[।.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length <= 1) return [trimmed];

  const groups: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    groups.push(sentences.slice(i, i + 2).join(' '));
  }
  return groups;
}
