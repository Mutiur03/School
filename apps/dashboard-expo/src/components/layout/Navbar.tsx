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
import { Image, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useGuardedNavigate } from '@/navigation/LeaveGuard';
import { useNav } from '@/navigation/nav-context';
import { useTenant } from '@/tenant/TenantProvider';
import { UserMenu } from './UserMenu';

function SchoolIdentity() {
  const { branding } = useTenant();
  return (
    <View
      className="min-w-0 shrink flex-row items-center gap-2"
      accessibilityLabel={`Active school: ${branding.displayName}`}
      testID="school-identity"
    >
      <View className="bg-border h-5 w-px" />
      {branding.logoUrl ? (
        <Image
          source={{ uri: branding.logoUrl }}
          accessibilityIgnoresInvertColors
          className="h-6 w-6 rounded"
        />
      ) : null}
      <Text size="sm" weight="medium" color="mutedForeground" numberOfLines={1} className="shrink">
        {branding.displayName}
      </Text>
    </View>
  );
}

export function Navbar({ compact }: { compact: boolean }) {
  const { title, homeHref } = useNav();
  const navigate = useGuardedNavigate();
  return (
    <View
      testID="navbar"
      className="border-border bg-sidebar z-[3] h-14 flex-row items-center justify-between gap-2 border-b px-3 sm:px-5"
    >
      <View className="min-w-0 shrink flex-row items-center gap-3">
        <Link
          href={homeHref}
          accessibilityRole="link"
          testID="navbar-home"
          onPress={(e) => {
            e.preventDefault();
            navigate(homeHref);
          }}
        >
          <Text weight="semibold" numberOfLines={1} className="text-lg sm:text-xl">
            {title}
          </Text>
        </Link>
        {compact ? null : <SchoolIdentity />}
      </View>
      <UserMenu placement={compact ? 'sheet' : 'dropdown'} />
      {/* Web's sidebar starts 1px up and covers this border, so the sidebar runs into the
          navbar seamlessly; RN web can't stack the sidebar over the navbar, so mask it here. */}
      {compact ? null : (
        <View
          pointerEvents="none"
          className="bg-sidebar absolute -bottom-px left-0 h-px w-[249px]"
        />
      )}
    </View>
  );
}
