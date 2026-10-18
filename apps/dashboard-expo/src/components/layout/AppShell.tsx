/**
 * Dashboard frame, mirroring dashboard/src/App.tsx:
 *   >= 768: Navbar across the top, persistent 250px Sidebar below it, scrolling content
 *   <  768: Navbar + content + bottom tab bar (Expo-only; the web dashboard uses a drawer)
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { BottomTabBar } from './BottomTabBar';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

export function AppShell({ children }: { children: ReactNode }) {
  const breakpoint = useBreakpoint();
  const insets = useSafeAreaInsets();
  const mobile = breakpoint === 'mobile';

  return (
    <View
      className="bg-background flex-1"
      style={{ paddingTop: insets.top }}
      testID={mobile ? 'shell-mobile' : 'shell-desktop'}
    >
      <Navbar compact={mobile} />
      {mobile ? (
        <>
          <View className="min-w-0 flex-1">{children}</View>
          <BottomTabBar />
        </>
      ) : (
        <View className="flex-1 flex-row">
          <Sidebar />
          <View className="min-w-0 flex-1">{children}</View>
        </View>
      )}
    </View>
  );
}
