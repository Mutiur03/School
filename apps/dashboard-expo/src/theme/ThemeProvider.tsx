import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { defaultTheme, type Theme, type ThemeColors } from './tokens';

/**
 * The subset of the theme a tenant may override. The backend has no theme fields today
 * (School model, main @ 13003bf4), so every tenant renders the default theme for now.
 */
export interface TenantThemeOverrides {
  primary?: string;
}

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
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
