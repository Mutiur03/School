import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverSrcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const readServerSource = (relativePathFromSrc: string): string =>
  fs.readFileSync(path.join(serverSrcRoot, relativePathFromSrc), 'utf8');

/** Contact fields intentionally visible on the public teacher/staff directory. */
export const PUBLIC_PERSONNEL_ANON_CONTACT_KEYS = ['email', 'phone'] as const;

/** Must not appear on anonymous public teacher/staff responses (admin JWT gets full rows). */
export const PUBLIC_PERSONNEL_ADMIN_ONLY_KEYS = [
  'address',
  'nid',
  'national_id',
  'password',
  'token_version',
  'tokenVersion',
  'signature',
  'school_id',
] as const;

export const sampleTeacherRow = (): Record<string, unknown> => ({
  id: 7,
  name: 'Test Teacher',
  designation: 'Senior Teacher',
  image: '1/teachers/photo.jpg',
  available: true,
  email: 'teacher@school.example',
  phone: '01700000000',
  address: '123 Secret Lane',
  signature: '1/teachers/sig.png',
  school_id: 1,
  nid: '1234567890',
  password: 'hash',
  token_version: 2,
});

export async function importOrFail<T extends Record<string, unknown>>(
  modulePath: string,
  exportName: keyof T,
): Promise<T[keyof T]> {
  let mod: T;
  try {
    mod = (await import(modulePath)) as T;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Expected module ${modulePath} (${String(exportName)}): ${detail}`);
  }
  const value = mod[exportName];
  if (typeof value !== 'function') {
    throw new Error(`Expected export ${String(exportName)} from ${modulePath}`);
  }
  return value as T[keyof T];
}

import { runWithRlsContext } from '@/config/rlsContextStore.js';

export const withSchoolRls = <T>(schoolId: number, fn: () => T): T =>
  runWithRlsContext({ schoolId, isSuperAdmin: false }, fn);
