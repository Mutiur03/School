/** The teacher fields of the login / refresh `user` payload (auth.service.ts), read defensively. */
import type { AuthUser } from '@/lib/api/auth';

export interface TeacherProfile {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  designation: string | null;
  address: string | null;
  image: string | null;
  signature: string | null;
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function teacherProfile(user: AuthUser | null | undefined): TeacherProfile | null {
  if (!user || user.role !== 'teacher') return null;
  return {
    id: user.id,
    name: str(user.name) ?? 'Teacher',
    email: str(user.email) ?? '',
    phone: str(user.phone),
    designation: str(user.designation),
    address: str(user.address),
    image: str(user.image),
    signature: str(user.signature),
  };
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';
