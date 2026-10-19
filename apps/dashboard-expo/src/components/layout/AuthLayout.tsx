/** Centered card for the pre-auth screens (school code, scan, confirm, login). */
import type { ReactNode } from 'react';
import { Image, View } from 'react-native';
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { School } from '@/components/ui/icons';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

export function SchoolMark({ logoUrl, size = 56 }: { logoUrl: string | null; size?: number }) {
  return logoUrl ? (
    <Image
      source={{ uri: logoUrl }}
      accessibilityIgnoresInvertColors
      style={{ width: size, height: size, borderRadius: 12 }}
    />
  ) : (
    <View
      className="bg-primary/10 items-center justify-center rounded-xl"
      style={{ width: size, height: size }}
    >
      <Icon icon={School} size={size / 2} color="primary" />
    </View>
  );
}

export function AuthLayout({
  title,
  description,
  header,
  footer,
  testID,
  children,
}: {
  title: string;
  description?: string;
  header?: ReactNode;
  footer?: ReactNode;
  testID?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { shadows } = useTheme();
  return (
    <View className="bg-muted flex-1">
      <KeyboardAwareScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingTop: 24 + insets.top,
          paddingBottom: 24 + insets.bottom,
          paddingHorizontal: 16,
        }}
      >
        <View
          testID={testID}
          className="border-border bg-card w-full max-w-[400px] gap-5 self-center rounded-xl border p-6"
          style={{ boxShadow: shadows.sm }}
        >
          {header}
          <View className="gap-1">
            <Text size="xl" weight="semibold" accessibilityRole="header">
              {title}
            </Text>
            {description ? (
              <Text size="sm" color="mutedForeground">
                {description}
              </Text>
            ) : null}
          </View>
          {children}
        </View>
        {footer ? <View className="mt-4 items-center">{footer}</View> : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

export function FieldLabel({ children, nativeID }: { children: string; nativeID?: string }) {
  return (
    <Text size="sm" weight="medium" nativeID={nativeID}>
      {children}
    </Text>
  );
}
