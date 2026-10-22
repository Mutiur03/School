/**
 * Account menu behind the navbar Power button (the web dashboard's Power button opens a logout
 * confirmation, components/DeleteConfimation.tsx). Desktop: popover panel. Phone: bottom sheet.
 * Profile opens the teacher's settings (teachers) or My Profile (students); a placeholder for
 * admins. "Switch school" (school-code installs only) signs out and drops
 * everything cached for the current school.
 * Platform (super-admin) mode: no Profile / Switch school; "App sign-in code" shows the platform
 * access code + QR (it only opens super-admin sign-in from the school-code screen). Logout also
 * forgets the platform choice (signs out, purges platform caches and storage) and returns to the
 * school-code screen.
 */
import { Download, LogOut, Power, QrCode, RefreshCw, User } from '@/components/ui/icons';
import { useGuardedAction, useGuardedNavigate } from '@/navigation/LeaveGuard';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AnimatedModal } from '@/components/ui/AnimatedModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Icon, type LucideIcon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { PlatformCodeDialog } from '@/features/platform/PlatformCodeDialog';
import { useSwitchSchool } from '@/school/useSwitchSchool';
import { useSession } from '@/session/ApiProvider';
import { useTenant } from '@/tenant/TenantProvider';
import { cn } from '@/lib/utils';
import { useTheme } from '@/theme/ThemeProvider';

function MenuItem({
  icon,
  label,
  hint,
  disabled,
  destructive,
  onPress,
  testID,
}: {
  testID?: string;
  icon: LucideIcon;
  label: string;
  hint?: string;
  disabled?: boolean;
  destructive?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="menuitem"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'min-h-9 flex-row items-center gap-2 rounded-sm px-2 py-1.5',
        disabled ? 'opacity-50' : 'hover:bg-accent',
      )}
    >
      <Icon icon={icon} size={16} color={destructive ? 'destructive' : 'mutedForeground'} />
      <Text size="sm" color={destructive ? 'destructive' : 'popoverForeground'} className="flex-1">
        {label}
      </Text>
      {hint ? <Badge label={hint} variant="secondary" /> : null}
    </Pressable>
  );
}

export function UserMenu({ placement }: { placement: 'dropdown' | 'sheet' }) {
  const [open, setOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const { shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const { branding, resolution } = useTenant();
  const switchSchool = useSwitchSchool();
  const navigate = useGuardedNavigate();
  const guarded = useGuardedAction();
  const platformMode = resolution.source === 'platform';
  // OTA build stamp: "built-in" = the JS shipped in the binary; otherwise the update's short id
  // and publish date (same id/createdAt the publish script prints).
  const { currentlyRunning, isUpdatePending } = Updates.useUpdates();
  const build = currentlyRunning.isEmbeddedLaunch
    ? 'built-in'
    : `${currentlyRunning.updateId?.slice(0, 8)} · ${currentlyRunning.createdAt?.toLocaleString() ?? ''}`;

  const name =
    session.status === 'authenticated'
      ? (session.user?.name ?? session.user?.username ?? session.user?.email ?? 'Signed in')
      : 'Guest';
  const subtitle =
    session.status === 'authenticated'
      ? (session.user?.role ?? '').replace('_', ' ')
      : session.status === 'unknown'
        ? 'Checking session…'
        : 'Not signed in';

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open account menu"
        testID="user-menu-button"
        onPress={() => setOpen(true)}
        className="bg-popover h-8 w-8 items-center justify-center rounded-full active:opacity-70"
      >
        <Icon icon={Power} size={19} />
      </Pressable>

      <AnimatedModal
        visible={open}
        variant={placement === 'sheet' ? 'sheet' : 'popover'}
        scrimOpacity={placement === 'sheet' ? 0.4 : 0}
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          accessibilityLabel="Close account menu"
          className="absolute inset-0"
          onPress={() => setOpen(false)}
        />
        <View
          testID="user-menu"
          className={cn(
            'border-border bg-popover absolute rounded-xl border p-1',
            placement === 'sheet'
              ? 'bottom-0 left-0 right-0 rounded-b-none'
              : 'right-4 top-[52px] w-64',
          )}
          style={{
            boxShadow: shadows.popover,
            paddingBottom: placement === 'sheet' ? 16 + insets.bottom : undefined,
          }}
        >
          <View className="border-border mb-1 border-b p-2">
            <Text size="sm" weight="semibold" color="popoverForeground">
              {name}
            </Text>
            <Text size="xs" color="mutedForeground" numberOfLines={1}>
              {subtitle} · {branding.shortName ?? branding.displayName}
            </Text>
          </View>
          {platformMode ? null : session.user?.role === 'teacher' ||
            session.user?.role === 'student' ? (
            <MenuItem
              icon={User}
              label="Profile"
              onPress={() => {
                setOpen(false);
                navigate(
                  session.user?.role === 'teacher' ? '/teacher/settings' : '/student/profile',
                );
              }}
            />
          ) : (
            <MenuItem icon={User} label="Profile" hint="Soon" disabled />
          )}
          {platformMode && session.status === 'authenticated' ? (
            <MenuItem
              testID="user-menu-platform-code"
              icon={QrCode}
              label="App sign-in code"
              onPress={() => {
                setOpen(false);
                setCodeOpen(true);
              }}
            />
          ) : null}
          {resolution.source === 'school-code' ? (
            <MenuItem
              icon={RefreshCw}
              label="Switch school"
              onPress={() => {
                setOpen(false);
                guarded(() => void switchSchool());
              }}
            />
          ) : null}
          <MenuItem
            icon={LogOut}
            label="Logout"
            destructive
            disabled={session.status !== 'authenticated'}
            onPress={() => {
              setOpen(false);
              setLogoutOpen(true);
            }}
          />
          {isUpdatePending ? (
            <MenuItem
              icon={Download}
              label="Restart to update"
              hint="New"
              onPress={() => guarded(() => void Updates.reloadAsync())}
            />
          ) : null}
          {Updates.isEnabled ? (
            <Text size="xs" color="mutedForeground" className="px-2 pt-2">
              v{Constants.expoConfig?.version} · {build}
            </Text>
          ) : null}
        </View>
      </AnimatedModal>
      <ConfirmDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title="Log out?"
        message="You will be logged out of your account. Tap Logout to continue."
        confirmLabel="Logout"
        onConfirm={() => {
          setLogoutOpen(false);
          guarded(() => void (platformMode ? switchSchool() : session.signOut()));
        }}
      />
      {platformMode ? (
        <PlatformCodeDialog open={codeOpen} onClose={() => setCodeOpen(false)} />
      ) : null}
    </>
  );
}
