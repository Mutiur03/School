/**
 * Full-screen startup / "checking session" screen. Always paints the light background itself, so
 * nothing behind it (Android's window background follows the phone's dark mode) can show through,
 * and centres the school mark with the dashboard's spinner (web components/Loading.tsx: Loader2,
 * text-primary). It never spins forever: callers pass an error, and after SLOW_AFTER_MS without one
 * it offers Retry anyway.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { RefreshCw, WifiOff } from '@/components/ui/icons';
import { Spinner } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { lightColors } from '@/theme/tokens';
import { DEFAULT_DISPLAY_NAME } from '@/tenant/branding';
import { SchoolMark } from './AuthLayout';

export const SLOW_AFTER_MS = 12_000;

export interface BootScreenProps {
  /** School (or app) name under the mark. */
  name?: string;
  logoUrl?: string | null;
  /** Short status line under the spinner, e.g. "Checking your session…". */
  label?: string;
  /** Startup failed: show this message with Retry instead of the spinner. */
  error?: string | null;
  onRetry?: () => void;
  /** Offered alongside Retry so a dead school host is never a dead end. */
  onSwitchSchool?: () => void;
  /** Label for the switch action (platform mode: "Use a school code"). */
  switchLabel?: string;
  /**
   * Hide text until fonts are ready (the root font gate), so nothing reflows. The mark and the
   * spinner still show.
   */
  textReady?: boolean;
  testID?: string;
}

export function BootScreen({
  name = DEFAULT_DISPLAY_NAME,
  logoUrl = null,
  label = 'Loading…',
  error = null,
  onRetry,
  onSwitchSchool,
  switchLabel = 'Switch school',
  textReady = true,
  testID = 'boot-screen',
}: BootScreenProps) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (error) return;
    setSlow(false);
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [error, label]);

  const failed = Boolean(error);
  const showActions = failed || (slow && Boolean(onRetry));

  return (
    <View
      testID={testID}
      // Inline colour as well as the class: this screen can render before NativeWind's CSS
      // variables are applied, and must never be transparent.
      style={{ flex: 1, backgroundColor: lightColors.background }}
      className="bg-background flex-1 items-center justify-center px-8"
      accessibilityRole={failed ? 'alert' : 'progressbar'}
      accessibilityLabel={failed ? (error ?? undefined) : label}
    >
      <View className="w-full max-w-[320px] items-center">
        <SchoolMark logoUrl={logoUrl} size={72} />
        {textReady ? (
          <Text
            size="lg"
            weight="semibold"
            className="mt-4 text-center"
            numberOfLines={2}
            testID="boot-screen-name"
          >
            {name}
          </Text>
        ) : null}

        <View className="mt-8 min-h-[56px] items-center">
          {failed ? (
            <View className="items-center gap-2">
              <Icon icon={WifiOff} size={24} color="mutedForeground" />
              {textReady ? (
                <Text size="sm" color="mutedForeground" className="text-center" testID="boot-error">
                  {error}
                </Text>
              ) : null}
            </View>
          ) : (
            <View className="items-center gap-3">
              <Spinner size={24} />
              {textReady ? (
                <Text size="xs" color="mutedForeground" className="text-center">
                  {slow ? 'This is taking longer than usual…' : label}
                </Text>
              ) : null}
            </View>
          )}
        </View>

        {showActions && textReady ? (
          <View className="mt-6 w-full gap-2">
            {onRetry ? (
              <Button
                testID="boot-retry"
                size="lg"
                icon={RefreshCw}
                label="Try again"
                onPress={onRetry}
              />
            ) : null}
            {onSwitchSchool ? (
              <Button
                testID="boot-switch-school"
                variant="ghost"
                size="lg"
                label={switchLabel}
                onPress={onSwitchSchool}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}
