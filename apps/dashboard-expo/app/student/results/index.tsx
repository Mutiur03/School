/**
 * My results, replicating dashboard/src/pages/Students/Result.tsx: academic-record hero,
 * "Choose an exam" (academic year, last 5 sessions; only published exams), then the result.
 * Expo shows the published exams as a tappable list that opens the result screen.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { ChevronRight, ClipboardList, GraduationCap, Search } from '@/components/ui/icons';
import { SectionCard } from '@/components/ui/SectionCard';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { Hero, ProfileBadges } from '@/features/student/components';
import { formatDate } from '@/features/student/format';
import { useMyProfile, usePublishedExams } from '@/features/student/hooks';
import { cn } from '@/lib/utils';
import { useSession } from '@/session/ApiProvider';

const CURRENT = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT - i);

export default function StudentResults() {
  const router = useRouter();
  const { user } = useSession();
  const [year, setYear] = useState(CURRENT);
  const profile = useMyProfile(year);
  const exams = usePublishedExams(year);

  return (
    <PageLayout
      title="My results"
      description="Published exam marks for your session. Download the official marksheet PDF when ready."
      onRefresh={() => {
        void exams.refetch();
        void profile.refetch();
      }}
      refreshing={exams.isRefetching}
    >
      <Hero>
        <View className="flex-row items-center gap-4">
          <View className="bg-primary/10 rounded-xl p-3">
            <Icon icon={GraduationCap} size={24} color="primary" />
          </View>
          <View className="min-w-0 flex-1">
            <Text size="sm" weight="medium" color="primary">
              Academic record
            </Text>
            <Text size="lg" weight="semibold">
              {profile.data?.name ?? user?.name ?? ''}
            </Text>
            {profile.data ? (
              <ProfileBadges
                profile={profile.data}
                extra={<Badge variant="outline" label={`Session ${year}`} />}
              />
            ) : (
              <View className="mt-2 flex-row gap-2">
                <Badge variant="outline" label={`Login ID ${user?.login_id ?? ''}`} />
                <Badge variant="outline" label={`Session ${year}`} />
              </View>
            )}
          </View>
        </View>
      </Hero>

      <SectionCard
        title="Choose an exam"
        description="Only published results appear here."
        icon={<Icon icon={Search} size={20} color="primary" />}
        noPadding
      >
        <View className="flex-row flex-wrap items-center gap-2 px-6 pb-4">
          <Text size="sm" weight="medium" color="mutedForeground">
            Academic year
          </Text>
          {YEARS.map((y) => (
            <Pressable
              key={y}
              accessibilityRole="radio"
              aria-checked={y === year}
              accessibilityState={{ checked: y === year }}
              testID={`year-${y}`}
              onPress={() => setYear(y)}
              className={cn(
                'h-9 min-w-[56px] items-center justify-center rounded-md border px-3',
                y === year ? 'border-primary bg-primary/10' : 'border-border',
              )}
            >
              <Text size="sm" weight="medium" tabular color={y === year ? 'primary' : 'foreground'}>
                {y}
              </Text>
            </Pressable>
          ))}
        </View>
        {exams.isPending ? (
          <View className="gap-2 px-6 pb-6">
            <Skeleton height={44} />
            <Skeleton height={44} />
          </View>
        ) : exams.isError ? (
          <ErrorState
            title="Couldn't load exams"
            message={exams.error.message}
            onRetry={() => void exams.refetch()}
          />
        ) : exams.data.length === 0 ? (
          <View
            className="border-border bg-muted/30 mx-6 mb-6 items-center rounded-lg border border-dashed px-4 py-5"
            testID="no-results"
          >
            <Text size="sm" weight="medium">
              No published results for {year}
            </Text>
            <Text size="sm" color="mutedForeground" className="mt-1 text-center">
              When the school publishes exam results, they will show up here.
            </Text>
          </View>
        ) : (
          <View testID="exam-list">
            {exams.data.map((e) => (
              <Pressable
                key={e.id}
                accessibilityRole="link"
                testID={`exam-${e.id}`}
                onPress={() =>
                  router.navigate({
                    pathname: '/student/results/[exam]',
                    params: { exam: e.exam_name, year: String(year) },
                  } as never)
                }
                className="border-border hover:bg-muted/40 active:bg-muted/40 min-h-[56px] flex-row items-center gap-3 border-t px-6 py-3"
              >
                <Icon icon={ClipboardList} size={18} color="primary" />
                <View className="min-w-0 flex-1">
                  <Text size="sm" weight="medium">
                    {e.exam_name}
                  </Text>
                  {e.result_date ? (
                    <Text size="xs" color="mutedForeground">
                      Result {formatDate(e.result_date)}
                    </Text>
                  ) : null}
                </View>
                <Icon icon={ChevronRight} size={16} color="mutedForeground" />
              </Pressable>
            ))}
          </View>
        )}
      </SectionCard>
    </PageLayout>
  );
}
