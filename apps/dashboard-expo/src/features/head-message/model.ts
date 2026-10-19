/**
 * Pure helpers for Message from Head (dashboard/src/pages/Admin/Head.tsx and
 * dashboard/src/lib/headMessage.ts, kept in sync with client-next/lib/headMessage.ts).
 */

const SENTENCE_END = '।.!?';

/**
 * Split text after sentence punctuation followed by whitespace, keeping the punctuation (the
 * web's `/(?<=[।.!?])\s+/`, written without a lookbehind for older JS engines).
 */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (!SENTENCE_END.includes(text[i]!)) continue;
    let j = i + 1;
    while (j < text.length && /\s/.test(text[j]!)) j++;
    if (j > i + 1) {
      out.push(text.slice(start, i + 1));
      start = j;
      i = j - 1;
    }
  }
  out.push(text.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}

/** Blank lines split paragraphs; one block is grouped two sentences per paragraph. */
export function toParagraphs(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (/\n\s*\n/.test(trimmed)) {
    return trimmed
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
  }
  const sentences = splitSentences(trimmed);
  if (sentences.length <= 1) return [trimmed];
  const groups: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    groups.push(sentences.slice(i, i + 2).join(' '));
  }
  return groups;
}

/** "1,204 chars · 210 words · 4 paragraphs" counter under the textarea. */
export function messageCounter(text: string): string {
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const paras = toParagraphs(text).length;
  return `${chars.toLocaleString()} chars · ${words.toLocaleString()} word${words === 1 ? '' : 's'} · ${paras} paragraph${paras === 1 ? '' : 's'}`;
}

export interface HeadDraft {
  teacherId: number | null;
  role: string;
  message: string;
}

export const sameDraft = (a: HeadDraft, b: HeadDraft) =>
  a.teacherId === b.teacherId && a.role === b.role && a.message === b.message;
