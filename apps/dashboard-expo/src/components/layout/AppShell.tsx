/**
 * Dashboard frame, mirroring dashboard/src/App.tsx:
 *   >= 768: Navbar across the top, persistent 250px Sidebar below it, scrolling content
 *   <  768: Navbar + content + bottom tab bar (Expo-only; the web dashboard uses a drawer)
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useTheme } from '@/theme/ThemeProvider';
import { BottomTabBar } from './BottomTabBar';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

export function AppShell({ children }: { children: ReactNode }) {
  const breakpoint = useBreakpoint();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const mobile = breakpoint === 'mobile';

  return (
    <View
      style={[styles.column, { backgroundColor: colors.background, paddingTop: insets.top }]}
      testID={mobile ? 'shell-mobile' : 'shell-desktop'}
    >
      <Navbar compact={mobile} />
      {mobile ? (
        <>
          <View style={styles.flex}>{children}</View>
          <BottomTabBar />
        </>
      ) : (
        <View style={styles.row}>
          <Sidebar />
          <View style={styles.flex}>{children}</View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { flex: 1 },
  row: { flex: 1, flexDirection: 'row' },
  flex: { flex: 1, minWidth: 0 },
});
