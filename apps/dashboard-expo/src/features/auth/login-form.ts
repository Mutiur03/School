/** Role-specific login fields and client-side checks, mirroring packages/shared-schemas. */
import { ApiError } from '@/lib/api';
import { WrongDeploymentRoleError } from '@/navigation/deployment-lock';
import type { AppRole } from '@/navigation/role-routes';

export interface LoginField {
  key: 'username' | 'email' | 'login_id';
  label: string;
  placeholder: string;
  keyboardType: 'default' | 'email-address' | 'number-pad';
  autoComplete: 'username' | 'email' | 'off';
}

export const LOGIN_FIELDS: Record<AppRole, LoginField> = {
  admin: {
    key: 'username',
    label: 'Username',
    placeholder: 'Your admin username',
    keyboardType: 'default',
    autoComplete: 'username',
  },
  teacher: {
    key: 'email',
    label: 'Email',
    placeholder: 'you@example.com',
    keyboardType: 'email-address',
    autoComplete: 'email',
  },
  student: {
    key: 'login_id',
    label: 'Login ID',
    placeholder: '6-digit login ID',
    keyboardType: 'number-pad',
    autoComplete: 'off',
  },
};

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: 'Admin',
  teacher: 'Teacher',
  student: 'Student',
};

export type LoginBody =
  | { role: 'admin'; body: { username: string; password: string } }
  | { role: 'teacher'; body: { email: string; password: string } }
  | { role: 'student'; body: { login_id: string; password: string } };

export function buildLoginBody(
  role: AppRole,
  identifier: string,
  password: string,
): { ok: true; value: LoginBody } | { ok: false; error: string } {
  const id = identifier.trim();
  if (!id) return { ok: false, error: `${LOGIN_FIELDS[role].label} is required.` };
  if (!password) return { ok: false, error: 'Password is required.' };
  switch (role) {
    case 'admin':
      return { ok: true, value: { role, body: { username: id, password } } };
    case 'teacher':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id)) {
        return { ok: false, error: 'Enter a valid email address.' };
      }
      return { ok: true, value: { role, body: { email: id.toLowerCase(), password } } };
    case 'student':
      if (!/^\d{6}$/.test(id)) return { ok: false, error: 'Login ID must be exactly 6 digits.' };
      return { ok: true, value: { role, body: { login_id: id, password } } };
  }
}

/** Never says which half was wrong. */
export function loginErrorMessage(error: unknown): string {
  if (error instanceof WrongDeploymentRoleError) return error.message;
  if (error instanceof ApiError) {
    if (error.isTransport) return "Can't reach the server. Check your connection and try again.";
    if (error.status === 429) return 'Too many attempts. Wait a few minutes and try again.';
    if (error.status === 402)
      return "This school's subscription is inactive. Contact the school office.";
    if (error.status === 400 || error.status === 401 || error.status === 404) {
      return "Those details didn't match. Check them and try again.";
    }
    if (error.status === 403) return error.message || 'This account cannot sign in.';
  }
  return 'Something went wrong. Try again.';
}
