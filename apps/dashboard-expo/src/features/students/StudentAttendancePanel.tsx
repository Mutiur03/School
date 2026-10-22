/** Attendance tab of the student details dialog (web StudentAttendanceView, embedded): month stepper, stats, calendar, recent days. */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import {
  AttendanceCalendar,
  AttendanceStats,
  MonthStepper,
  RecentDays,
} from '@/features/student/components';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';

export function StudentAttendancePanel({
  studentId,
  initialYear,
}: {
  studentId: number;
  initialYear?: number;
}) {
  const { student } = useApi();
  const { resolution } = useTenant();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(initialYear ?? now.getFullYear());
  const q = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'student-attendance', studentId, year, month),
    queryFn: ({ signal }) => student.attendanceOf({ studentId, month, year }, signal),
    placeholderData: keepPreviousData,
  });
  const step = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setMonth(d.getMonth());
    setYear(d.getFullYear());
  };

  return (
    <View className="gap-4" testID="student-attendance-panel">
      <View className="items-end">
        <MonthStepper month={month} year={year} onStep={step} noFuture />
      </View>
      {q.isError && !q.data ? (
        <ErrorState
          title="Couldn't load attendance"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <>
          <AttendanceStats data={q.data} loading={q.isPending} />
          <AttendanceCalendar
            year={year}
            month={month}
            data={q.data}
            loading={q.isPending}
            fetching={q.isFetching}
          />
          {q.data && q.data.records.length === 0 ? (
            <Text size="sm" color="mutedForeground" className="text-center">
              No attendance marked for this month yet.
            </Text>
          ) : (
            <RecentDays data={q.data} />
          )}
        </>
      )}
    </View>
  );
}
