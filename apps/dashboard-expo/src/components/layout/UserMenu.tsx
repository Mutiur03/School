/**
 * Account menu behind the navbar Power button (the web dashboard's Power button opens a logout
 * confirmation, components/DeleteConfimation.tsx). Desktop: popover panel. Phone: bottom sheet.
 * Profile / switch school are placeholders until login lands; sign-out works with a session.
 */
import { LogOut, Power, RefreshCw, User } from '@/components/ui/icons';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '@/components/ui/Badge';
import { Icon, type LucideIcon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
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
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  disabled?: boolean;
  destructive?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
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
  const { shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const { branding } = useTenant();

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

      <Modal
        transparent
        visible={open}
        animationType={placement === 'sheet' ? 'slide' : 'fade'}
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          accessibilityLabel="Close account menu"
          className={cn('absolute inset-0', placement === 'sheet' && 'bg-black/40')}
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
          <MenuItem icon={User} label="Profile" hint="Soon" disabled />
          <MenuItem icon={RefreshCw} label="Switch school" hint="Soon" disabled />
          <MenuItem
            icon={LogOut}
            label="Logout"
            destructive
            disabled={session.status !== 'authenticated'}
            onPress={() => {
              setOpen(false);
              void session.signOut();
            }}
          />
        </View>
      </Modal>
    </>
  );
}
