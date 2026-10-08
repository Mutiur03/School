import type { AuthUser } from '../../common/current-user.decorator.js';

/** The fields access checks read (the worker passes a synthetic admin). */
export type AccessUser = Pick<AuthUser, 'id' | 'role' | 'levels'>;

/** Admin: any student. Teacher: only their assigned class/section/year. Student: only themself. */
export function canAccessStudent(
  user: AccessUser,
  studentId: number,
  className: number,
  section: string,
  year: number,
): boolean {
  if (user.role === 'admin') return true;
  if (user.role === 'teacher') {
    return !!user.levels?.some(
      (level: any) =>
        level.class_name === className && level.section === section && level.year === year,
    );
  }
  if (user.role === 'student') return user.id === studentId;
  return false;
}
