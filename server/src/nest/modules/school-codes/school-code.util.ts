import { randomInt } from 'node:crypto';

/** No 0/O, 1/I/L, so a code read aloud or off a screen cannot be mistyped into another one. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 7; // 31^7 ≈ 2.75e10 codes, ABC-7K4Q

export function generateSchoolCode(rand: (max: number) => number = randomInt): string {
  let raw = '';
  for (let i = 0; i < CODE_LENGTH; i++) raw += CODE_ALPHABET[rand(CODE_ALPHABET.length)];
  return `${raw.slice(0, 3)}-${raw.slice(3)}`;
}

/**
 * Canonical form of user input ("abc 7k4q", "ABC-7K4Q", "abc7k4q" → "ABC-7K4Q"), or null when it
 * cannot be a code. Characters outside the alphabet are rejected rather than guessed.
 */
export function normalizeSchoolCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[\s-]/g, '');
  if (raw.length !== CODE_LENGTH) return null;
  for (const ch of raw) if (!CODE_ALPHABET.includes(ch)) return null;
  return `${raw.slice(0, 3)}-${raw.slice(3)}`;
}
