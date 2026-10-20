/**
 * "App sign-in code" (super-admin user menu dialog, and the card on the platform Overview like
 * dashboard/src/pages/SuperAdmin/PlatformAccessCode.tsx): the server's platform access code as text + QR.
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
import { Copy, Eye, EyeOff, KeyRound, Share2 } from '@/components/ui/icons';
import { Icon } from '@/components/ui/Icon';
import { SectionCard } from '@/components/ui/SectionCard';
import { Skeleton } from '@/components/ui/states';
import { ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { CodeQr } from '@/features/school-codes/SchoolCodesScreen';
import { usePlatformApi } from '@/session/ApiProvider';
import { usePlatformKey } from './ui';

function usePlatformCode(enabled: boolean) {
  const platform = usePlatformApi();
  const key = usePlatformKey();
  const [copied, setCopied] = useState(false);
  const q = useQuery({
    queryKey: key('platform-code'),
    queryFn: ({ signal }) => platform.getPlatformCode(signal),
    enabled,
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

  return { q, code, copied, share };
}

const SHARE_ICON = Platform.OS === 'web' ? Copy : Share2;

/** Overview card: code hidden until revealed; QR shown with it. */
export function PlatformCodeCard() {
  const { q, code, copied, share } = usePlatformCode(true);
  const [shown, setShown] = useState(false);

  return (
    <SectionCard
      title="App sign-in code"
      icon={<Icon icon={KeyRound} size={20} color="primary" />}
      testID="platform-code-card"
    >
      <Text size="sm" color="mutedForeground" className="mb-4">
        Enter or scan this in the mobile app&apos;s school-code screen to open super-admin sign-in.
        It only opens the sign-in screen; your email and password are still required.
      </Text>
      {q.isPending ? (
        <Skeleton height={36} width={160} />
      ) : q.isError ? (
        <ErrorState message="Couldn't load the code." onRetry={() => void q.refetch()} />
      ) : code ? (
        <View className="gap-4">
          <View className="flex-row flex-wrap items-center gap-2">
            <View className="bg-muted rounded px-3 py-1.5">
              <Text size="lg" selectable={shown} className="font-mono tracking-widest">
                {shown ? code : '•••-••••'}
              </Text>
            </View>
            <Button
              variant="outline"
              size="sm"
              icon={shown ? EyeOff : Eye}
              label={shown ? 'Hide' : 'Show'}
              onPress={() => setShown((s) => !s)}
            />
            <Button
              variant="outline"
              size="sm"
              icon={SHARE_ICON}
              label={Platform.OS === 'web' ? (copied ? 'Copied' : 'Copy') : 'Share'}
              onPress={() => void share()}
            />
          </View>
          {shown ? <CodeQr code={code} size={200} /> : null}
        </View>
      ) : (
        <Text size="sm" color="mutedForeground">
          Not configured. Set PLATFORM_ACCESS_CODE on the server to enable it.
        </Text>
      )}
    </SectionCard>
  );
}

export function PlatformCodeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { q, code, copied, share } = usePlatformCode(open);

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
            icon={SHARE_ICON}
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
