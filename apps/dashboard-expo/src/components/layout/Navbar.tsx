/**
 * Port of dashboard/src/components/Navbar.tsx: sticky `h-[3.5rem] bg-sidebar border-b px-3 sm:px-5`,
 * role title on the left ("Admin", `text-lg sm:text-xl font-semibold`), Power button on the right
 * (`bg-popover rounded-full p-2`, scaled 0.8).
 *
 * Expo differences (deliberate):
 *  - no burger: phones use the bottom tab bar instead of the slide-over drawer;
 *  - the active school is shown next to the role title (tenant branding requirement); the web
 *    navbar has no school identity because each school has its own dashboard deployment.
 */
import { Link } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useMinWidth } from '@/hooks/useBreakpoint';
import { useTenant } from '@/tenant/TenantProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { UserMenu } from './UserMenu';

function SchoolIdentity() {
  const { branding } = useTenant();
  const { colors, radii } = useTheme();
  return (
    <View
      style={styles.school}
      accessibilityLabel={`Active school: ${branding.displayName}`}
      testID="school-identity"
    >
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      {branding.logoUrl ? (
        <Image
          source={{ uri: branding.logoUrl }}
          accessibilityIgnoresInvertColors
          style={{ width: 24, height: 24, borderRadius: radii.base }}
        />
      ) : null}
      <Text size="sm" weight="medium" color="mutedForeground" numberOfLines={1} style={styles.flex}>
        {branding.displayName}
      </Text>
    </View>
  );
}

export function Navbar({ compact }: { compact: boolean }) {
  const { colors, layout } = useTheme();
  const sm = useMinWidth('sm');
  return (
    <View
      testID="navbar"
      style={[
        styles.bar,
        {
          height: layout.navbarHeight,
          backgroundColor: colors.sidebar,
          borderBottomColor: colors.border,
          paddingHorizontal: sm ? 20 : 12,
        },
      ]}
    >
      <View style={styles.left}>
        <Link href="/" accessibilityRole="link" testID="navbar-home">
          <Text size={sm ? 'xl' : 'lg'} weight="semibold" numberOfLines={1}>
            Admin
          </Text>
        </Link>
        {compact ? null : <SchoolIdentity />}
      </View>
      <UserMenu placement={compact ? 'sheet' : 'dropdown'} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderBottomWidth: 1,
    zIndex: 3,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1, minWidth: 0 },
  school: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, minWidth: 0 },
  divider: { width: 1, height: 20 },
  flex: { flexShrink: 1 },
});
