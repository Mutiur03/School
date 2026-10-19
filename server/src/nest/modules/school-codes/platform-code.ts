import { timingSafeEqual } from 'node:crypto';
import { normalizeSchoolCode } from './school-code.util.js';

/**
 * Platform (super-admin) access code. It has the same format as a school code, so the app's code
 * box and QR scanner take it unchanged, but it lives only in the server's env
 * (`PLATFORM_ACCESS_CODE`), never in the DB or a client bundle. A lookup that matches it answers
 * `{ target: 'platform' }`: the app then opens super-admin sign-in. It only opens a sign-in screen.
 * It does not authorize anything: the super-admin email + password login and the super-admin
 * host check still decide every request.
 *
 * Unset or malformed → the feature is off and the code is a plain "School code not found".
 * Rotate by changing the env and restarting. Generate with:
 *   node -e "const c=require('crypto'),a='ABCDEFGHJKMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<7;i++)s+=a[c.randomInt(a.length)];console.log(s.slice(0,3)+'-'+s.slice(3))"
 */
export function platformAccessCode(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env.PLATFORM_ACCESS_CODE;
  return raw ? normalizeSchoolCode(raw) : null;
}

/** Constant-time match of an already-normalised code against the configured platform code. */
export function isPlatformAccessCode(code: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const expected = platformAccessCode(env);
  if (!expected) return false;
  const a = Buffer.from(code);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
