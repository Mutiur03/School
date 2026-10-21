/** TanStack Query hooks for the admin overview. Keys live under the tenant's private namespace. */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { AttendanceRange } from '@/lib/api';
import { sessionUserId, useApi, useSession } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';

function useOverviewKey() {
  const { resolution } = useTenant();
  const session = useSession();
  return (...parts: unknown[]) =>
    privateQueryKey(resolution.tenantKey, 'dashboard', sessionUserId(session) ?? 'anon', ...parts);
}

export function useDashboardOverview() {
  const { dashboard } = useApi();
  const key = useOverviewKey();
  return useQuery({
    queryKey: key('overview'),
    queryFn: ({ signal }) => dashboard.overview(signal),
  });
}

export function useDashboardAttendance(days: AttendanceRange) {
  const { dashboard } = useApi();
  const key = useOverviewKey();
  return useQuery({
    queryKey: key('attendance', days),
    queryFn: ({ signal }) => dashboard.attendance(days, signal),
    placeholderData: keepPreviousData,
  });
}
