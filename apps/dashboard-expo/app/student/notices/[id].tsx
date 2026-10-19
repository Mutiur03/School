/** Notice detail: title, date and the attachment (public CDN file, opened like the web does). */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, ExternalLink } from '@/components/ui/icons';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState, ErrorMessage, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { openNoticeFile } from '@/features/student/components';
import { formatDate } from '@/features/student/format';
import { useNotices } from '@/features/student/hooks';

export default function NoticeDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useNotices();
  const [error, setError] = useState<string | null>(null);
  const notice = q.data?.find((n) => String(n.id) === id);
  const back = (
    <Button
      variant="ghost"
      size="sm"
      icon={ArrowLeft}
      label="All notices"
      onPress={() => router.navigate('/student/notices')}
    />
  );
  return (
    <PageLayout
      title="Notice"
      actions={back}
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      {q.isPending ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState
          title="Couldn't load this notice"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : !notice ? (
        <EmptyState message="This notice is no longer available." />
      ) : (
        <SectionCard testID="notice-detail">
          <Text size="xl" weight="semibold" testID="notice-title">
            {notice.title}
          </Text>
          <Text size="sm" color="mutedForeground" className="mt-1">
            Published {formatDate(notice.created_at)}
          </Text>
          <View className="mt-5 items-start gap-2">
            {notice.file || notice.download_url ? (
              <Button
                testID="open-attachment"
                icon={ExternalLink}
                label="Open attachment"
                onPress={() =>
                  void openNoticeFile(notice).then(
                    (ok) => setError(ok ? null : 'This attachment is not available.'),
                    () => setError("Couldn't open the attachment."),
                  )
                }
              />
            ) : (
              <Text size="sm" color="mutedForeground">
                No attachment.
              </Text>
            )}
            {error ? <ErrorMessage message={error} /> : null}
          </View>
        </SectionCard>
      )}
    </PageLayout>
  );
}
