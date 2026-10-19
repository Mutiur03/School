/** School notices (GET /api/notices/getNotices: school-wide, newest first), list → detail. */
import { useRouter } from 'expo-router';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { NoticeRow } from '@/features/student/components';
import { useNotices } from '@/features/student/hooks';

export default function StudentNotices() {
  const router = useRouter();
  const q = useNotices();
  return (
    <PageLayout
      title="Notices"
      description={q.data ? `${q.data.length} notices` : undefined}
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      {q.isPending ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState
          title="Couldn't load notices"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <SectionCard noPadding testID="notice-list">
          {q.data.length === 0 ? (
            <EmptyState message="No notices yet." />
          ) : (
            q.data.map((n, i) => (
              <NoticeRow
                key={n.id}
                notice={n}
                first={i === 0}
                onPress={() =>
                  router.navigate({
                    pathname: '/student/notices/[id]',
                    params: { id: String(n.id) },
                  } as never)
                }
              />
            ))
          )}
        </SectionCard>
      )}
    </PageLayout>
  );
}
