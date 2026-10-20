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
import { usePathname } from 'expo-router';
import { useGuardedNavigate } from '@/navigation/LeaveGuard';
import { ChevronDown } from '@/components/ui/icons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, View } from 'react-native';
import { ScrollView } from '@/components/ui/ScrollView';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useNav } from '@/navigation/nav-context';
import {
  activeGroupId,
  isActive,
  type NavEntry,
  type NavHref,
  type NavLink,
} from '@/navigation/nav-items';
import { cn } from '@/lib/utils';
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
  const { shadows } = useTheme();
  // Icon colours are lucide props, so hover is tracked in JS and shared by bg, text and icon.
  const [hovered, setHovered] = useState(false);
  const fg = active
    ? 'primaryForeground'
    : hovered || open
      ? 'sidebarAccentForeground'
      : 'sidebarForeground';
  return (
    <Pressable
      accessibilityRole={open === undefined ? 'link' : 'button'}
      accessibilityState={open === undefined ? { selected: !!active } : { expanded: open }}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      testID={testID}
      className={cn(
        'flex-row items-center gap-3 rounded-sm px-3',
        child ? 'py-1.5' : 'py-2',
        active ? 'bg-primary' : (hovered || open) && 'bg-sidebar-accent',
      )}
      style={active ? { boxShadow: shadows.sm } : undefined}
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
  return (
    <View className="border-border ml-4 mt-1 gap-1 border-l pl-7">
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
                className="flex-1"
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

/** Same timing as the web sidebar's framer-motion dropdown (0.2s height + fade, chevron rotate). */
const GROUP_DURATION_MS = 200;

/** 0 = closed, 1 = open, animated. Core Animated (no Reanimated in the web bundle). */
function useOpenProgress(open: boolean) {
  const progress = useRef(new Animated.Value(open ? 1 : 0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion, () => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) setMounted(true);
    const animation = Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: reduceMotion ? 0 : GROUP_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // height is a layout prop
    });
    animation.start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
    return () => animation.stop();
  }, [open, progress, reduceMotion]);
  return { progress, mounted };
}

/** Animates height 0 <-> content height with a fade; children unmount once fully closed. */
function Collapse({
  progress,
  mounted,
  children,
}: {
  progress: Animated.Value;
  mounted: boolean;
  children: ReactNode;
}) {
  const [contentHeight, setContentHeight] = useState(0);
  if (!mounted) return null;
  return (
    <Animated.View
      style={{
        overflow: 'hidden',
        opacity: progress,
        height: progress.interpolate({ inputRange: [0, 1], outputRange: [0, contentHeight] }),
      }}
    >
      <View
        style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
        onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}
      >
        {children}
      </View>
    </Animated.View>
  );
}

function NavGroup({
  entry,
  items,
  open,
  onToggle,
  pathname,
  go,
}: {
  entry: NavEntry;
  items: NavLink[];
  open: boolean;
  onToggle: () => void;
  pathname: string;
  go: (href: NavHref) => void;
}) {
  const { progress, mounted } = useOpenProgress(open);
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  return (
    <>
      <NavRow open={open} onPress={onToggle} testID={`nav-group-${entry.id}`}>
        {(fg) => (
          <>
            <Icon icon={entry.icon} size={16} color={fg} />
            <Text size="base" weight="medium" color={fg} numberOfLines={1} className="flex-1">
              {entry.label}
            </Text>
            <Animated.View style={{ transform: [{ rotate }] }}>
              <Icon icon={ChevronDown} size={16} color="mutedForeground" />
            </Animated.View>
          </>
        )}
      </NavRow>
      <Collapse progress={progress} mounted={mounted}>
        <ChildLinks items={items} pathname={pathname} go={go} />
      </Collapse>
    </>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const navigate = useGuardedNavigate();
  const { entries, homeHref } = useNav();
  const [openId, setOpenId] = useState<string | null>(() => activeGroupId(pathname, entries));

  // Follow the route: open the group holding it, or close all on a top-level page (the web
  // sidebar closes its dropdown on top-level link clicks). Runs after a guarded navigation lands.
  useEffect(() => {
    setOpenId(activeGroupId(pathname, entries));
  }, [pathname, entries]);

  const go = (href: NavHref) => {
    onNavigate?.();
    navigate(href);
  };

  return (
    <View className="gap-1 px-2">
      {entries.map((entry: NavEntry, i) => {
        const prev = entries[i - 1];
        const showSection = entry.section && entry.section !== prev?.section;
        const open = openId === entry.id;
        return (
          <View key={entry.id}>
            {showSection ? <SectionLabel label={entry.section!} /> : null}
            {entry.items ? (
              <NavGroup
                entry={entry}
                items={entry.items}
                open={open}
                onToggle={() => setOpenId(open ? null : entry.id)}
                pathname={pathname}
                go={go}
              />
            ) : (
              <NavRow
                active={isActive(pathname, entry.href, entry.href === homeHref)}
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
                      className="flex-1"
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
    <Text size="xs" weight="semibold" color="mutedForeground" caps className="px-3 pb-1 pt-3">
      {label}
    </Text>
  );
}

export function Sidebar() {
  const { shadows } = useTheme();
  return (
    <View
      role="navigation"
      accessibilityLabel="Main navigation"
      testID="sidebar"
      className="border-border bg-sidebar z-[2] -mt-px w-[250px] border-r"
      style={{ boxShadow: shadows.sidebar }}
    >
      <ScrollView contentContainerClassName="py-4" showsVerticalScrollIndicator={false}>
        <SidebarNav />
      </ScrollView>
    </View>
  );
}
