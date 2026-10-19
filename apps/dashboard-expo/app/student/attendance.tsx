/**
 * Attendance record, replicating dashboard/src/components/students/StudentAttendanceView.tsx
 * (web: Profile → Attendance tab): month stepper, Present / Absent / Run awayed / Rate cards,
 * monthly calendar with P/A/R cells, recent marked days. The API has no holiday data, and the
 * web view shows none either.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { Icon } from '@/components/ui/Icon';
import { CalendarDays } from '@/components/ui/icons';
import { ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import {
  AttendanceCalendar,
  AttendanceStats,
  MonthStepper,
  RecentDays,
} from '@/features/student/components';
import { useMyAttendance } from '@/features/student/hooks';

export default function StudentAttendance() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const q = useMyAttendance(month, year);
  const step = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setMonth(d.getMonth());
    setYear(d.getFullYear());
  };

  return (
    <PageLayout title="Attendance" onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <View className="flex-row items-center gap-2">
          <Icon icon={CalendarDays} size={20} color="primary" />
          <View>
            <Text size="sm" weight="medium">
              Attendance record
            </Text>
            <Text size="xs" color="mutedForeground">
              Monthly view of marked days
            </Text>
          </View>
        </View>
        <MonthStepper month={month} year={year} onStep={step} />
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
            <Text size="sm" color="mutedForeground" className="text-center" testID="no-attendance">
              No attendance marked for this month.
            </Text>
          ) : (
            <RecentDays data={q.data} />
          )}
        </>
      )}
    </PageLayout>
  );
}
