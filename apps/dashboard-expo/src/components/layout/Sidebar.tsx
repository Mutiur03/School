/**
 * Port of dashboard/src/components/Sidebar.tsx (expanded state, >= 768px):
 *   aside  bg-sidebar border-r w-[250px] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)], below the navbar
 *   nav    py-4, list px-2 space-y-1
 *   item   rounded-sm px-3 py-2 font-medium gap-3, 16px icon; active bg-primary text-primary-foreground
 *          shadow-sm; hover bg-sidebar-accent
 *   section text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3 pt-3 pb-1
 *   group  toggle with ChevronDown (rotates), children ml-4 border-l pl-7, items px-3 py-1.5
 * Also used inside the phone "More" sheet (`onNavigate` closes the sheet).
 */
import { usePathname, useRouter } from 'expo-router';
import { ChevronDown } from '@/components/ui/icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import {
  ADMIN_NAV,
  activeGroupId,
  isActive,
  type NavEntry,
  type NavHref,
  type NavLink,
} from '@/navigation/nav-items';
import { useTheme } from '@/theme/ThemeProvider';

function NavRow({
  active,
  open,
  child,
  onPress,
  testID,
  children,
}: {
  active?: boolean;
  open?: boolean;
  child?: boolean;
  onPress: () => void;
  testID?: string;
  children: (
    fg: 'primaryForeground' | 'sidebarAccentForeground' | 'sidebarForeground',
  ) => React.ReactNode;
}) {
  const { colors, radii, shadows } = useTheme();
  const [hovered, setHovered] = useState(false);
  const fg = active
    ? 'primaryForeground'
    : hovered || open
      ? 'sidebarAccentForeground'
      : 'sidebarForeground';
  const bg = active ? colors.primary : hovered || open ? colors.sidebarAccent : 'transparent';
  return (
    <Pressable
      accessibilityRole={open === undefined ? 'link' : 'button'}
      accessibilityState={open === undefined ? { selected: !!active } : { expanded: open }}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      testID={testID}
      style={[
        styles.row,
        child ? styles.rowChild : styles.rowTop,
        {
          backgroundColor: bg,
          borderRadius: radii.sm,
          boxShadow: active ? shadows.sm : undefined,
        },
      ]}
    >
      {children(fg)}
    </Pressable>
  );
}

function ChildLinks({
  items,
  pathname,
  go,
}: {
  items: NavLink[];
  pathname: string;
  go: (href: NavHref) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.children, { borderLeftColor: colors.border }]}>
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <NavRow
            key={item.id}
            child
            active={active}
            onPress={() => go(item.href)}
            testID={`nav-${item.id}`}
          >
            {(fg) => (
              <Text
                size="base"
                weight={active ? 'medium' : 'regular'}
                color={fg}
                numberOfLines={1}
                style={styles.label}
              >
                {item.label}
              </Text>
            )}
          </NavRow>
        );
      })}
    </View>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(() => activeGroupId(pathname));

  useEffect(() => {
    const id = activeGroupId(pathname);
    if (id) setOpenId(id);
  }, [pathname]);

  const go = (href: NavHref) => {
    router.navigate(href);
    onNavigate?.();
  };

  return (
    <View style={styles.list}>
      {ADMIN_NAV.map((entry: NavEntry, i) => {
        const prev = ADMIN_NAV[i - 1];
        const showSection = entry.section && entry.section !== prev?.section;
        const open = openId === entry.id;
        return (
          <View key={entry.id}>
            {showSection ? <SectionLabel label={entry.section!} /> : null}
            {entry.items ? (
              <>
                <NavRow
                  open={open}
                  onPress={() => setOpenId(open ? null : entry.id)}
                  testID={`nav-group-${entry.id}`}
                >
                  {(fg) => (
                    <>
                      <Icon icon={entry.icon} size={16} color={fg} />
                      <Text
                        size="base"
                        weight="medium"
                        color={fg}
                        numberOfLines={1}
                        style={styles.label}
                      >
                        {entry.label}
                      </Text>
                      <View style={open ? styles.chevronOpen : undefined}>
                        <Icon icon={ChevronDown} size={16} color="mutedForeground" />
                      </View>
                    </>
                  )}
                </NavRow>
                {open ? <ChildLinks items={entry.items} pathname={pathname} go={go} /> : null}
              </>
            ) : (
              <NavRow
                active={isActive(pathname, entry.href)}
                onPress={() => go(entry.href)}
                testID={`nav-${entry.id}`}
              >
                {(fg) => (
                  <>
                    <Icon icon={entry.icon} size={16} color={fg} />
                    <Text
                      size="base"
                      weight="medium"
                      color={fg}
                      numberOfLines={1}
                      style={styles.label}
                    >
                      {entry.label}
                    </Text>
                  </>
                )}
              </NavRow>
            )}
          </View>
        );
      })}
    </View>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <Text size="xs" weight="semibold" color="mutedForeground" caps style={styles.section}>
      {label}
    </Text>
  );
}

export function Sidebar() {
  const { colors, layout, shadows } = useTheme();
  return (
    <View
      role="navigation"
      accessibilityLabel="Main navigation"
      testID="sidebar"
      style={[
        styles.aside,
        {
          width: layout.sidebarWidth,
          backgroundColor: colors.sidebar,
          borderRightColor: colors.border,
          boxShadow: shadows.sidebar,
        },
      ]}
    >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SidebarNav />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  aside: { borderRightWidth: 1, zIndex: 2 },
  scroll: { paddingVertical: 16 },
  list: { paddingHorizontal: 8, gap: 4 },
  section: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTop: { paddingHorizontal: 12, paddingVertical: 8 },
  rowChild: { paddingHorizontal: 12, paddingVertical: 6 },
  label: { flex: 1 },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  children: { marginLeft: 16, paddingLeft: 28, borderLeftWidth: 1, gap: 4, marginTop: 4 },
});
