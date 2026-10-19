import { useMemo } from 'react';
import { useSession } from '@/session/ApiProvider';
import { classScope, parseTeacherLevels, type ClassScope } from './scope';

/** null for admins (no narrowing); the teacher's class scope otherwise. */
export function useClassScope(): ClassScope | null {
  const { user } = useSession();
  return useMemo(
    () => (user?.role === 'teacher' ? classScope(parseTeacherLevels(user)) : null),
    [user],
  );
}
