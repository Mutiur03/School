/**
 * Phone navigation (Expo-only pattern). The web dashboard hides its sidebar behind a burger on
 * phones; here the four most-used admin destinations are tabs and "More" opens the full admin
 * menu (the same SidebarNav, same labels and groups) in a bottom sheet.
 * Visual language follows the sidebar: bg-sidebar, border-border, primary = active.
 */
import { usePathname, useRouter } from 'expo-router';
import { Ellipsis } from '@/components/ui/icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type LucideIcon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { MOBILE_TABS, isActive } from '@/navigation/nav-items';
import { useTheme } from '@/theme/ThemeProvider';
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
  const { colors, radii } = useTheme();
  const fg = active ? 'primaryForeground' : 'mutedForeground';
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={styles.tab}
    >
      <View
        style={[
          styles.pill,
          { borderRadius: radii.sm, backgroundColor: active ? colors.primary : 'transparent' },
        ]}
      >
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
  const { colors, layout, radii } = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);
  const onTab = MOBILE_TABS.some((t) => isActive(pathname, t.href));

  return (
    <>
      <View
        role="tablist"
        testID="bottom-tab-bar"
        style={[
          styles.bar,
          {
            minHeight: layout.bottomBarHeight + insets.bottom,
            paddingBottom: insets.bottom,
            backgroundColor: colors.sidebar,
            borderTopColor: colors.border,
          },
        ]}
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
          style={styles.backdrop}
          onPress={() => setMoreOpen(false)}
        />
        <View
          testID="more-sheet"
          style={[
            styles.sheet,
            {
              backgroundColor: colors.sidebar,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              paddingBottom: insets.bottom + 8,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <ScrollView contentContainerStyle={styles.sheetScroll}>
            <SidebarNav onNavigate={() => setMoreOpen(false)} />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 6 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingBottom: 6 },
  pill: { paddingHorizontal: 14, paddingVertical: 4 },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '85%' },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginVertical: 8 },
  sheetScroll: { paddingBottom: 8 },
});
