/** Where each signed-in role lands. Only admins get the dashboard for now. */
export type AppRole = 'admin' | 'teacher' | 'student';

export const ROLE_HOME: Record<AppRole, string> = {
  admin: '/',
  teacher: '/teacher',
  student: '/student',
};

export const isAppRole = (role: unknown): role is AppRole =>
  role === 'admin' || role === 'teacher' || role === 'student';

/** null for roles this app does not serve (super_admin): the caller signs them out. */
export const homeForRole = (role: unknown): string | null =>
  isAppRole(role) ? ROLE_HOME[role] : null;
