/**
 * Phone navigation (Expo-only pattern). The web dashboard hides its sidebar behind a burger on
 * phones; here the four most-used admin destinations are tabs and "More" opens the full admin
 * menu (the same SidebarNav, same labels and groups) in a bottom sheet.
 *
 * Design: a docked surface (bg-sidebar, hairline border-t, soft upward shadow), not a floating
 * bar. At 390px a floating bar costs side insets and a bottom gap and hovers over table rows; the
 * dashboard's navbar and sidebar are docked flat surfaces too. One soft pill (primary/10) slides
 * behind the active icon (TabIndicator: Reanimated on native, a CSS transition on web; instant
 * when the OS asks for reduced motion); the
 * active icon and label switch to primary/foreground with a bolder label, inactive tabs are muted.
 * Tabs are full-height (64px) touch targets with tab semantics and pressed feedback.
 */
import { usePathname } from 'expo-router';
import { useGuardedNavigate } from '@/navigation/LeaveGuard';
import { useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import { AnimatedModal } from '@/components/ui/AnimatedModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type LucideIcon } from '@/components/ui/Icon';
import { Ellipsis } from '@/components/ui/icons';
import { ScrollView } from '@/components/ui/ScrollView';
import { Text } from '@/components/ui/Text';
import { useNav } from '@/navigation/nav-context';
import { isActive } from '@/navigation/nav-items';
import { layout } from '@/theme/tokens';
import { ActiveIndicator } from './TabIndicator';
import { SidebarNav } from './Sidebar';

/** Soft lift above content; RN boxShadow string (NativeWind v4 cannot express it, see README). */
const BAR_SHADOW = '0 -1px 3px 0 rgba(15, 23, 42, 0.04), 0 -4px 12px -2px rgba(15, 23, 42, 0.06)';

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
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      aria-selected={active}
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      className="flex-1 items-center gap-1 pt-2 active:scale-95 active:opacity-70"
      style={{ minHeight: layout.bottomBarHeight }}
    >
      <View className="h-8 w-14 items-center justify-center">
        <Icon icon={icon} size={20} color={active ? 'foreground' : 'mutedForeground'} />
      </View>
      <Text
        size="xs"
        weight={active ? 'semibold' : 'medium'}
        color={active ? 'foreground' : 'mutedForeground'}
        numberOfLines={1}
        className="text-[11px] leading-4"
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function BottomTabBar() {
  const pathname = usePathname();
  const navigate = useGuardedNavigate();
  const insets = useSafeAreaInsets();
  const [moreOpen, setMoreOpen] = useState(false);
  const [barWidth, setBarWidth] = useState(0);
  const { tabs, more, homeHref } = useNav();
  const tabIndex = tabs.findIndex((t) => isActive(pathname, t.href, t.href === homeHref));
  // Not a tab route: More (or nothing when there is no More tab).
  const activeIndex = tabIndex === -1 ? tabs.length : tabIndex;
  const count = tabs.length + (more ? 1 : 0);

  return (
    <>
      <View
        role="tablist"
        testID="bottom-tab-bar"
        className="border-border bg-sidebar flex-row border-t px-1"
        style={{ paddingBottom: insets.bottom, boxShadow: BAR_SHADOW }}
        onLayout={(e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width - 8)}
      >
        {barWidth > 0 && activeIndex < count ? (
          <View pointerEvents="none" className="absolute inset-y-0 left-1 right-1">
            <ActiveIndicator index={activeIndex} count={count} width={barWidth} />
          </View>
        ) : null}
        {tabs.map((tab, i) => (
          <Tab
            key={tab.id}
            label={tab.label}
            icon={tab.icon}
            active={i === activeIndex}
            onPress={() => navigate(tab.href)}
            testID={`tab-${tab.id}`}
          />
        ))}
        {more ? (
          <Tab
            label="More"
            icon={Ellipsis}
            active={activeIndex === tabs.length}
            onPress={() => setMoreOpen(true)}
            testID="tab-more"
          />
        ) : null}
      </View>

      <AnimatedModal
        visible={moreOpen}
        variant="sheet"
        scrimOpacity={0.4}
        onRequestClose={() => setMoreOpen(false)}
      >
        <Pressable
          accessibilityLabel="Close menu"
          className="absolute inset-0"
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
      </AnimatedModal>
    </>
  );
}
