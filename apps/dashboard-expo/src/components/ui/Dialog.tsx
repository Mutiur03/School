/**
 * Port of dashboard/src/components/Popup.tsx as used by the admin forms: a centred card
 * (`rounded-xl border bg-card shadow`), header `border-b px-5 py-4` with a `text-base
 * font-semibold` title and close button, scrolling body `px-5 py-4 gap-4`, footer
 * `border-t px-5 py-3` with right-aligned actions. Phones get a near-full-height sheet.
 */
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { cn } from '@/lib/utils';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from './Icon';
import { XIcon } from './icons';
import { FormChain } from './form-chain';
import { KeyboardAwareScrollView } from './KeyboardAwareScrollView';
import { Text } from './Text';

const WIDTH = { md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl', full: 'max-w-5xl' } as const;

export function CloseButton({ onPress, label = 'Close' }: { onPress: () => void; label?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      className="hover:bg-accent h-8 w-8 items-center justify-center rounded-md"
    >
      <Icon icon={XIcon} size={16} color="mutedForeground" />
    </Pressable>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'lg',
  testID,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof WIDTH;
  testID?: string;
}) {
  const { shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const mobile = useBreakpoint() === 'mobile';
  return (
    <Modal
      transparent
      visible={open}
      animationType={mobile ? 'slide' : 'fade'}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        // Android is edge-to-edge (SDK 57), so the window no longer resizes for the keyboard:
        // lift the sheet with padding on both platforms so its footer stays above the keyboard.
        behavior={Platform.OS === 'web' ? undefined : 'padding'}
        className={cn(
          'flex-1 bg-black/50',
          mobile ? 'justify-end' : 'items-center justify-center p-6',
        )}
      >
        <Pressable
          accessibilityLabel="Close dialog"
          className="absolute inset-0"
          onPress={onClose}
        />
        <View
          testID={testID}
          accessibilityViewIsModal
          className={cn(
            'border-border bg-card w-full overflow-hidden border',
            mobile ? 'max-h-[92%] rounded-t-xl' : cn('max-h-[90%] rounded-xl', WIDTH[size]),
          )}
          style={{ boxShadow: shadows.popover, paddingBottom: mobile ? insets.bottom : 0 }}
        >
          <View className="border-border flex-row items-center justify-between gap-3 border-b px-5 py-4">
            <View className="min-w-0 flex-1">
              <Text size="base" weight="semibold" accessibilityRole="header" numberOfLines={2}>
                {title}
              </Text>
              {description ? (
                <Text size="sm" color="mutedForeground" className="mt-0.5">
                  {description}
                </Text>
              ) : null}
            </View>
            <CloseButton onPress={onClose} />
          </View>
          <KeyboardAwareScrollView frame="shrink" contentContainerClassName="gap-4 px-5 py-4">
            <FormChain>{children}</FormChain>
          </KeyboardAwareScrollView>
          {footer ? (
            <View className="border-border flex-row flex-wrap items-center justify-end gap-2 border-t px-5 py-3">
              {footer}
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
