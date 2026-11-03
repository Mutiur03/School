/**
 * Three-dot "more actions" button for table rows: keeps the Actions column to one or two icons.
 * Opens a bottom sheet on phones and a centred card on wider screens (same as the Select list),
 * titled with the row (e.g. the student's name). Destructive items are red and sit last.
 */
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { cn } from '@/lib/utils';
import { useTheme } from '@/theme/ThemeProvider';
import { AnimatedModal } from './AnimatedModal';
import { Icon, type LucideIcon } from './Icon';
import { Ellipsis } from './icons';
import { Text } from './Text';

export interface RowMenuItem {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export function RowMenu({
  title,
  items,
  testID,
}: {
  /** What the menu is for, shown as its heading and in the button's label. */
  title: string;
  items: readonly RowMenuItem[];
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  const { colors, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const sheet = useBreakpoint() === 'mobile';
  const close = () => setOpen(false);
  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`More actions for ${title}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        className="hover:bg-accent h-8 w-8 items-center justify-center rounded-md"
      >
        <Icon icon={Ellipsis} size={16} rawColor={colors.mutedForeground} />
      </Pressable>
      <AnimatedModal
        visible={open}
        variant={sheet ? 'sheet' : 'center'}
        scrimOpacity={0.4}
        onRequestClose={close}
      >
        <View className={cn('flex-1', sheet ? 'justify-end' : 'items-center justify-center p-6')}>
          <Pressable accessibilityLabel="Close menu" className="absolute inset-0" onPress={close} />
          <View
            accessibilityRole="menu"
            className={cn(
              'border-border bg-popover w-full overflow-hidden border',
              sheet ? 'rounded-t-2xl' : 'max-w-xs rounded-xl',
            )}
            style={{ boxShadow: shadows.popover, paddingBottom: sheet ? insets.bottom : 0 }}
          >
            {sheet ? (
              <View className="items-center pt-2" importantForAccessibility="no">
                <View className="h-1 w-10 rounded-full bg-gray-300" />
              </View>
            ) : null}
            <View className="border-border border-b px-4 py-3">
              <Text size={sheet ? 'base' : 'sm'} weight="semibold" numberOfLines={1}>
                {title}
              </Text>
            </View>
            <View className="p-1">
              {items.map((it) => (
                <Pressable
                  key={it.label}
                  accessibilityRole="menuitem"
                  accessibilityState={{ disabled: !!it.disabled }}
                  disabled={it.disabled}
                  onPress={() => {
                    close();
                    it.onPress();
                  }}
                  className={cn(
                    'flex-row items-center gap-3 rounded-md px-3',
                    sheet ? 'min-h-12 py-3' : 'min-h-10 py-2',
                    it.disabled ? 'opacity-50' : 'hover:bg-accent active:bg-accent',
                  )}
                >
                  <Icon
                    icon={it.icon}
                    size={sheet ? 18 : 16}
                    color={it.destructive ? 'destructive' : 'mutedForeground'}
                  />
                  <Text
                    size={sheet ? 'base' : 'sm'}
                    color={it.destructive ? 'destructive' : 'popoverForeground'}
                  >
                    {it.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </AnimatedModal>
    </>
  );
}
