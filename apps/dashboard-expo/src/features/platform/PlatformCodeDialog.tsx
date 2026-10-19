/**
 * "App sign-in code" (super-admin user menu): the server's platform access code as text + QR.
 * Typed or scanned on the school-code screen it opens super-admin sign-in; it does not sign
 * anyone in. Fetched only while open (GET /api/auth/super_admin/platform-code, super_admin on
 * the super-admin host). Cached in the platform query namespace, which logout purges.
 * Web copies to the clipboard; native opens the share sheet (which has Copy), so no native
 * clipboard module is added.
 */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Platform, Share, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Copy, Share2 } from '@/components/ui/icons';
import { ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { CodeQr } from '@/features/school-codes/SchoolCodesScreen';
import { usePlatformApi } from '@/session/ApiProvider';
import { usePlatformKey } from './ui';

export function PlatformCodeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const platform = usePlatformApi();
  const key = usePlatformKey();
  const [copied, setCopied] = useState(false);
  const q = useQuery({
    queryKey: key('platform-code'),
    queryFn: ({ signal }) => platform.getPlatformCode(signal),
    enabled: open,
    staleTime: 0,
  });
  const code = q.data ?? null;

  const share = async () => {
    if (!code) return;
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        setCopied(false);
      }
      return;
    }
    await Share.share({ message: code }).catch(() => {});
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="App sign-in code"
      size="md"
      testID="platform-code-dialog"
    >
      {q.isPending ? (
        <Text size="sm" color="mutedForeground" className="text-center">
          Loading…
        </Text>
      ) : q.isError ? (
        <ErrorState message="Couldn't load the code." onRetry={() => void q.refetch()} />
      ) : code ? (
        <View className="items-center gap-3">
          <CodeQr code={code} size={200} />
          <Text
            testID="platform-code-value"
            size="xl"
            weight="bold"
            selectable
            className="font-mono tracking-widest"
          >
            {code}
          </Text>
          <Text size="sm" color="mutedForeground" className="text-center">
            Scan or type it on the app&apos;s school-code screen to open super-admin sign-in. Your
            email and password are still required.
          </Text>
          <Button
            testID="platform-code-share"
            variant="outline"
            icon={Platform.OS === 'web' ? Copy : Share2}
            label={Platform.OS === 'web' ? (copied ? 'Copied' : 'Copy code') : 'Share or copy'}
            onPress={() => void share()}
          />
        </View>
      ) : (
        <Text
          testID="platform-code-unset"
          size="sm"
          color="mutedForeground"
          className="text-center"
        >
          Not set up. Set PLATFORM_ACCESS_CODE on the server to enable it.
        </Text>
      )}
    </Dialog>
  );
}
