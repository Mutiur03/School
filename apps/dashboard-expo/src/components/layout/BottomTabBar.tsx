/**
 * Phone navigation (Expo-only pattern). The web dashboard hides its sidebar behind a burger on
 * phones; here the four most-used admin destinations are tabs and "More" opens the full admin
 * menu (the same SidebarNav, same labels and groups) in a bottom sheet.
 * Visual language follows the sidebar: bg-sidebar, border-border, primary = active.
 */
import { usePathname, useRouter } from 'expo-router';
import { Ellipsis } from '@/components/ui/icons';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { ScrollView } from '@/components/ui/ScrollView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type LucideIcon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { MOBILE_TABS, isActive } from '@/navigation/nav-items';
import { cn } from '@/lib/utils';
import { layout } from '@/theme/tokens';
import { SidebarNav } from './Sidebar';

function Tab({
  label,
  icon,
  active,
  onPress,
  testID,
}: {
  label: string;
  icon: LucideIcon;
  active: boolean;
  onPress: () => void;
  testID: string;
}) {
  const fg = active ? 'primaryForeground' : 'mutedForeground';
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      className="flex-1 items-center justify-center gap-0.5 pb-1.5"
    >
      <View className={cn('rounded-sm px-3.5 py-1', active && 'bg-primary')}>
        <Icon icon={icon} size={18} color={fg} />
      </View>
      <Text
        size="xs"
        weight={active ? 'semibold' : 'medium'}
        color={active ? 'foreground' : 'mutedForeground'}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function BottomTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [moreOpen, setMoreOpen] = useState(false);
  const onTab = MOBILE_TABS.some((t) => isActive(pathname, t.href));

  return (
    <>
      <View
        role="tablist"
        testID="bottom-tab-bar"
        className="border-border bg-sidebar flex-row border-t pt-1.5"
        style={{ minHeight: layout.bottomBarHeight + insets.bottom, paddingBottom: insets.bottom }}
      >
        {MOBILE_TABS.map((tab) => (
          <Tab
            key={tab.id}
            label={tab.label}
            icon={tab.icon}
            active={isActive(pathname, tab.href)}
            onPress={() => router.navigate(tab.href)}
            testID={`tab-${tab.id}`}
          />
        ))}
        <Tab
          label="More"
          icon={Ellipsis}
          active={!onTab}
          onPress={() => setMoreOpen(true)}
          testID="tab-more"
        />
      </View>

      <Modal
        transparent
        visible={moreOpen}
        animationType="slide"
        onRequestClose={() => setMoreOpen(false)}
      >
        <Pressable
          accessibilityLabel="Close menu"
          className="absolute inset-0 bg-black/40"
          onPress={() => setMoreOpen(false)}
        />
        <View
          testID="more-sheet"
          className="bg-sidebar absolute bottom-0 left-0 right-0 max-h-[85%] rounded-t-xl"
          style={{ paddingBottom: insets.bottom + 8 }}
        >
          <View className="bg-border my-2 h-1 w-9 self-center rounded-sm" />
          <ScrollView contentContainerClassName="pb-2">
            <SidebarNav onNavigate={() => setMoreOpen(false)} />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
