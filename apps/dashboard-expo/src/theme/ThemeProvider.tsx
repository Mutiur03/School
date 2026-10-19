import { colorScheme, vars } from 'nativewind';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { View } from 'react-native';
import { defaultTheme, hexToRgbChannels, type Theme, type ThemeColors } from './tokens';

/**
 * The subset of the theme a tenant may override. The backend has no theme fields today
 * (School model, main @ 13003bf4), so every tenant renders the default theme for now.
 */
export interface TenantThemeOverrides {
  primary?: string;
}

// Light only, like the web dashboard. Pin NativeWind's scheme so a phone in dark mode cannot
// activate dark variants (JS-only: no native config change, so it ships over the air).
colorScheme.set('light');

const HEX = /^#[0-9a-fA-F]{6}$/;

export function buildTheme(overrides: TenantThemeOverrides | undefined): Theme {
  if (!overrides?.primary || !HEX.test(overrides.primary)) return defaultTheme;
  const colors: ThemeColors = {
    ...defaultTheme.colors,
    primary: overrides.primary,
    ring: overrides.primary,
    sidebarPrimary: overrides.primary,
  };
  return { ...defaultTheme, colors };
}

const ThemeContext = createContext<Theme>(defaultTheme);

export function ThemeProvider({
  overrides,
  children,
}: {
  overrides?: TenantThemeOverrides;
  children: ReactNode;
}) {
  const theme = useMemo(() => buildTheme(overrides), [overrides]);
  // className colours read the CSS variables from global.css; overriding them here (NativeWind
  // vars()) re-themes every class below, while useTheme() serves the same values to props that
  // need raw colours (lucide icons, SVG). Always rendered so the tree is stable when branding loads.
  const cssVars = useMemo((): Record<`--${string}`, string> => {
    const primary = hexToRgbChannels(theme.colors.primary);
    if (theme === defaultTheme || !primary) return {};
    return { '--primary': primary, '--ring': primary, '--sidebar-primary': primary };
  }, [theme]);
  return (
    <ThemeContext.Provider value={theme}>
      <View className="flex-1" style={vars(cssVars)}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
