/**
 * Account menu behind the navbar Power button (the web dashboard's Power button opens a logout
 * confirmation, components/DeleteConfimation.tsx). Desktop: popover panel. Phone: bottom sheet.
 * Profile / switch school are placeholders until login lands; sign-out works with a session.
 */
import { LogOut, Power, RefreshCw, User } from '@/components/ui/icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '@/components/ui/Badge';
import { Icon, type LucideIcon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useSession } from '@/session/ApiProvider';
import { useTenant } from '@/tenant/TenantProvider';
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
  const { colors, radii } = useTheme();
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[
        styles.item,
        {
          borderRadius: radii.sm,
          backgroundColor: hovered && !disabled ? colors.accent : 'transparent',
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Icon icon={icon} size={16} color={destructive ? 'destructive' : 'mutedForeground'} />
      <Text size="sm" color={destructive ? 'destructive' : 'popoverForeground'} style={styles.flex}>
        {label}
      </Text>
      {hint ? <Badge label={hint} variant="secondary" /> : null}
    </Pressable>
  );
}

export function UserMenu({ placement }: { placement: 'dropdown' | 'sheet' }) {
  const [open, setOpen] = useState(false);
  const { colors, radii, shadows } = useTheme();
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
        style={({ pressed }) => [
          styles.power,
          { backgroundColor: colors.popover, opacity: pressed ? 0.7 : 1 },
        ]}
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
          style={[styles.backdrop, placement === 'sheet' && styles.backdropDim]}
          onPress={() => setOpen(false)}
        />
        <View
          testID="user-menu"
          style={[
            styles.panel,
            {
              backgroundColor: colors.popover,
              borderColor: colors.border,
              borderRadius: radii.xl,
              boxShadow: shadows.popover,
            },
            placement === 'sheet'
              ? [styles.sheet, { paddingBottom: 16 + insets.bottom }]
              : styles.dropdown,
          ]}
        >
          <View style={[styles.who, { borderBottomColor: colors.border }]}>
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

const styles = StyleSheet.create({
  power: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: StyleSheet.absoluteFill,
  backdropDim: { backgroundColor: 'rgba(0,0,0,0.4)' },
  panel: { position: 'absolute', borderWidth: 1, padding: 4 },
  dropdown: { top: 52, right: 16, width: 256 },
  sheet: { left: 0, right: 0, bottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  who: { paddingHorizontal: 8, paddingVertical: 8, marginBottom: 4, borderBottomWidth: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 36,
  },
  flex: { flex: 1 },
});
