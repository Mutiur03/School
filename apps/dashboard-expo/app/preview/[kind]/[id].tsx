/**
 * Web only: full-page registration form preview, the web dashboard's public /preview/class6/:id
 * (and class8, class9, junior-scholarship) pages. Loads the form PDF with this session's
 * credentials and shows it in one frame. Phones use the "Preview PDF" button instead.
 */
import { useQuery } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { LoadingState, ErrorState } from '@/components/ui/states';
import { REG_CONFIG, type RegVariant } from '@/lib/api';
import { useApi } from '@/session/ApiProvider';

const KINDS: Record<string, RegVariant> = {
  class6: 'class-6',
  class8: 'class-8',
  class9: 'class-9',
  'junior-scholarship': 'junior-scholarship',
};

export default function RegistrationPreview() {
  const { kind, id } = useLocalSearchParams<{ kind: string; id: string }>();
  const { registration } = useApi();
  const variant = KINDS[String(kind)];
  const [url, setUrl] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ['registration-preview', variant, id],
    enabled: Platform.OS === 'web' && !!variant && !!id,
    queryFn: () => registration.pdf(REG_CONFIG[variant!], String(id)),
    gcTime: 0,
    retry: false,
  });

  useEffect(() => {
    if (!q.data) return;
    const u = URL.createObjectURL(new Blob([q.data], { type: 'application/pdf' }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [q.data]);

  if (Platform.OS !== 'web' || !variant || !id) return <Redirect href="/" />;
  if (q.isError) {
    return (
      <ErrorState
        title="Couldn't load the preview"
        message="Sign in as an admin of this school, then open the preview again."
        onRetry={() => void q.refetch()}
      />
    );
  }
  if (!url) return <LoadingState label="Loading preview…" />;
  return (
    <View style={{ flex: 1 }}>
      <iframe
        src={url}
        title="Registration preview"
        width="100%"
        height="100%"
        style={{ border: 0, flex: 1, minHeight: '100vh' }}
      />
    </View>
  );
}
