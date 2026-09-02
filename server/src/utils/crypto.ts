import crypto from 'crypto';
import { env } from '@/config/env.js';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const key = Buffer.from(env.ENCRYPTION_KEY, 'hex');

/** Encrypts a secret for storage. Output: base64(iv || authTag || ciphertext). */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
}

/**
 * Decrypts a value produced by encryptSecret. Falls back to returning the
 * input unchanged if it isn't in the encrypted format, so values stored
 * before encryption was introduced keep working until they're re-saved.
 */
export function decryptSecret(stored: string): string {
  try {
    const raw = Buffer.from(stored, 'base64');
    if (raw.length <= IV_LENGTH + AUTH_TAG_LENGTH) return stored;
    const iv = raw.subarray(0, IV_LENGTH);
    const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    return stored;
  }
}

export function maskSecret(plaintext: string): string {
  if (plaintext.length <= 4) return '••••';
  return `••••${plaintext.slice(-4)}`;
}
