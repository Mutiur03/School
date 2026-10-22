/**
 * Student home, replicating dashboard/src/pages/Students/StudentDashboard.tsx (hero with photo,
 * "Welcome back", login ID, class/section/roll badges; "This month's attendance" stats) and
 * adding the latest published result and the latest notices.
 */
import { Link, useRouter } from 'expo-router';
import { View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Bell, CalendarDays, ClipboardList, GraduationCap, User } from '@/components/ui/icons';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { totalMarks } from '@/lib/api';
import {
  AttendanceStats,
  fileUrl,
  Hero,
  NoticeRow,
  Photo,
  ProfileBadges,
} from '@/features/student/components';
import {
  useMyAttendance,
  useMyMarks,
  useMyProfile,
  useNotices,
  usePublishedExams,
  useResultYears,
} from '@/features/student/hooks';
import { useSession } from '@/session/ApiProvider';

const NOW = new Date();
const YEAR = NOW.getFullYear();

function SectionTitle({ icon, title, to }: { icon: typeof Bell; title: string; to?: string }) {
  return (
    <View className="mb-3 flex-row items-center gap-2">
      <Icon icon={icon} size={16} color="primary" />
      <Text size="sm" weight="semibold" className="flex-1">
        {title}
      </Text>
      {to ? (
        <Link href={to as never} accessibilityRole="link">
          <Text size="sm" weight="medium" color="primary">
            View all
          </Text>
        </Link>
      ) : null}
    </View>
  );
}

function LatestResult() {
  const router = useRouter();
  // The newest session that has published results for this student, not just this year.
  const years = useResultYears();
  const resultYear = years.data?.[0] ?? YEAR;
  const exams = usePublishedExams(resultYear);
  const latest = exams.data?.at(-1) ?? null;
  const marks = useMyMarks(resultYear, latest?.exam_name ?? null);
  const body =
    years.isPending || exams.isPending ? (
      <View className="p-5">
        <Skeleton height={48} />
      </View>
    ) : exams.isError ? (
      <ErrorState
        title="Couldn't load results"
        message={exams.error.message}
        onRetry={() => void exams.refetch()}
      />
    ) : !latest ? (
      <EmptyState message={'No published results yet.'} />
    ) : (
      <View className="flex-row flex-wrap items-center gap-4 p-5" testID="latest-result">
        <View className="min-w-0 flex-1">
          <Text size="xs" weight="medium" color="primary">
            Latest published result
          </Text>
          <Text size="lg" weight="semibold" className="mt-0.5">
            {latest.exam_name}
          </Text>
          <Text size="sm" color="mutedForeground" tabular>
            {marks.isPending
              ? 'Loading marks…'
              : marks.isError
                ? 'Marks unavailable'
                : marks.data.length
                  ? `${marks.data.length} subjects · Total ${totalMarks(marks.data)}`
                  : 'No marks entered yet'}
          </Text>
        </View>
        <Button
          variant="outline"
          label="View result"
          onPress={() =>
            router.navigate({
              pathname: '/student/results/[exam]',
              params: { exam: latest.exam_name, year: String(resultYear) },
            } as never)
          }
        />
      </View>
    );
  return <SectionCard noPadding>{body}</SectionCard>;
}

export default function StudentHome() {
  const router = useRouter();
  const { user } = useSession();
  const profile = useMyProfile(YEAR);
  const attendance = useMyAttendance(NOW.getMonth(), YEAR);
  const notices = useNotices();
  const exams = useResultYears();
  const name = profile.data?.name ?? user?.name ?? 'Student';
  const refreshing = profile.isRefetching || attendance.isRefetching || notices.isRefetching;

  return (
    <PageLayout
      title="Student Dashboard"
      description="Your classes, records, and quick links."
      onRefresh={() => {
        void profile.refetch();
        void attendance.refetch();
        void notices.refetch();
        void exams.refetch();
      }}
      refreshing={refreshing}
    >
      {profile.isError && !profile.data ? (
        <ErrorState
          title="Couldn't load your profile"
          message={profile.error.message}
          onRetry={() => void profile.refetch()}
        />
      ) : (
        <Hero testID="student-hero">
          <View className="flex-row flex-wrap items-center gap-6">
            {profile.isPending ? (
              <Skeleton width={96} height={123} />
            ) : (
              <Photo
                name={name}
                url={fileUrl(profile.data?.image ?? (user?.image as string | null))}
              />
            )}
            <View className="min-w-[200px] flex-1">
              <Text size="sm" weight="medium" color="primary">
                Welcome back
              </Text>
              <Text size="2xl" weight="bold" className="mt-1" testID="student-name">
                {name}
              </Text>
              <Text size="sm" color="mutedForeground" className="mt-1">
                Login ID {profile.data?.login_id ?? user?.login_id ?? ''}
              </Text>
              {profile.data ? <ProfileBadges profile={profile.data} /> : null}
            </View>
            <View className="flex-row flex-wrap gap-2">
              <Button
                variant="outline"
                icon={ClipboardList}
                label="My results"
                onPress={() => router.navigate('/student/results')}
              />
              <Button
                variant="outline"
                icon={CalendarDays}
                label="Attendance"
                onPress={() => router.navigate('/student/attendance')}
              />
              <Button
                variant="outline"
                icon={User}
                label="My profile"
                onPress={() => router.navigate('/student/profile')}
              />
            </View>
          </View>
        </Hero>
      )}

      <View>
        <SectionTitle
          icon={CalendarDays}
          title="This month's attendance"
          to="/student/attendance"
        />
        {attendance.isError && !attendance.data ? (
          <ErrorState
            title="Couldn't load attendance"
            message={attendance.error.message}
            onRetry={() => void attendance.refetch()}
          />
        ) : (
          <AttendanceStats data={attendance.data} loading={attendance.isPending} rateOnly />
        )}
      </View>

      <View>
        <SectionTitle icon={GraduationCap} title="Results" to="/student/results" />
        <LatestResult />
      </View>

      <View>
        <SectionTitle icon={Bell} title="Latest notices" to="/student/notices" />
        <SectionCard noPadding testID="home-notices">
          {notices.isPending ? (
            <View className="gap-2 p-5">
              <Skeleton height={20} />
              <Skeleton height={20} />
            </View>
          ) : notices.isError ? (
            <ErrorState
              title="Couldn't load notices"
              message={notices.error.message}
              onRetry={() => void notices.refetch()}
            />
          ) : notices.data.length === 0 ? (
            <EmptyState message="No notices yet." />
          ) : (
            notices.data
              .slice(0, 3)
              .map((n, i) => <NoticeRow key={n.id} notice={n} first={i === 0} />)
          )}
        </SectionCard>
      </View>
    </PageLayout>
  );
}
