/** TanStack Query hooks for the student home. Keys live under the tenant's private namespace. */
import { useQuery } from '@tanstack/react-query';
import { sessionUserId, useApi, useSession } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';

export function useStudentKey() {
  const { resolution } = useTenant();
  const session = useSession();
  // Keyed by the signed-in student too, so a different student on this device never sees
  // cached data of the previous one even before the purge runs.
  return (...parts: unknown[]) =>
    privateQueryKey(resolution.tenantKey, 'student', sessionUserId(session) ?? 'anon', ...parts);
}

export function useMyId(): number | undefined {
  const session = useSession();
  const role = session.user?.role ?? session.provisional?.role;
  // Key / URL only (the saved id at launch); the server authorizes every request.
  return role === 'student' ? sessionUserId(session) : undefined;
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

/** Sessions with published results for this student, newest first. */
export function useResultYears() {
  const { student } = useApi();
  const key = useStudentKey();
  return useQuery({
    queryKey: key('result-years'),
    queryFn: ({ signal }) => student.resultYears(signal),
    staleTime: 60_000,
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
