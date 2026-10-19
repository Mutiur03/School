/** TanStack Query hooks for the student home. Keys live under the tenant's private namespace. */
import { useQuery } from '@tanstack/react-query';
import { useApi, useSession } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';

export function useStudentKey() {
  const { resolution } = useTenant();
  const session = useSession();
  // Keyed by the signed-in student too, so a different student on this device never sees
  // cached data of the previous one even before the purge runs.
  return (...parts: unknown[]) =>
    privateQueryKey(resolution.tenantKey, 'student', session.user?.id ?? 'anon', ...parts);
}

export function useMyId(): number | undefined {
  const { user } = useSession();
  return user?.role === 'student' ? user.id : undefined;
}

export function useMyProfile(year: number) {
  const { student } = useApi();
  const key = useStudentKey();
  return useQuery({
    queryKey: key('profile', year),
    queryFn: ({ signal }) => student.me(year, signal),
    staleTime: 60_000,
  });
}

export function useMyAttendance(month: number, year: number) {
  const { student } = useApi();
  const key = useStudentKey();
  return useQuery({
    queryKey: key('attendance', year, month),
    queryFn: ({ signal }) => student.attendance({ month, year }, signal),
  });
}

export function usePublishedExams(year: number) {
  const { student } = useApi();
  const key = useStudentKey();
  return useQuery({
    queryKey: key('exams', year),
    queryFn: ({ signal }) => student.publishedExams(year, signal),
    staleTime: 60_000,
  });
}

export function useMyMarks(year: number, exam: string | null) {
  const { student } = useApi();
  const key = useStudentKey();
  const studentId = useMyId();
  return useQuery({
    queryKey: key('marks', year, exam),
    queryFn: ({ signal }) => student.marks({ studentId: studentId!, year, exam: exam! }, signal),
    enabled: !!studentId && !!exam,
  });
}

export function useNotices() {
  const { student } = useApi();
  const key = useStudentKey();
  return useQuery({
    queryKey: key('notices'),
    queryFn: ({ signal }) => student.notices(signal),
    staleTime: 60_000,
  });
}
