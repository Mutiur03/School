/**
 * Design tokens ported from the existing web dashboard so the Expo app matches it visually.
 *
 * Source of truth (do not guess values, re-derive them from these files):
 *   - dashboard/src/index.css          shadcn CSS variables (:root and .dark), --radius, fonts
 *   - dashboard/components.json        shadcn "new-york" style, neutral base, lucide icons
 *   - tailwindcss@4.3.3 theme.css      text scale, font weights, tracking, shadows, palette
 *
 * Tailwind v4 palette colours are oklch in theme.css; the hex values below are their sRGB
 * conversions. Plain values (no styling library) so they work on web and native.
 */

/** Tailwind palette entries the dashboard uses directly in class names (oklch -> hex). */
export const tw = {
  emerald100: '#d0fae5', // StatusBadge approved/active bg
  emerald500: '#00bc7d', // exam "Ongoing" bg at 10%
  emerald700: '#007a55', // exam "Ongoing" text
  emerald800: '#006045', // StatusBadge approved/active text
  blue500: '#2b7fff', // exam "Upcoming" bg at 10%
  blue700: '#1447e6', // exam "Upcoming" text
  red100: '#ffe2e2',
  red800: '#9f0712',
  amber100: '#fef3c6',
  amber800: '#973c00',
  gray400: '#99a1af', // input placeholder
  gray700: '#364153',
  gray800: '#1e2939',
  gray900: '#101828', // SectionCard / PageHeader title colour
  white: '#ffffff',
  black: '#000000',
} as const;

/** shadcn semantic colours. Key names mirror the CSS variables in dashboard/src/index.css. */
export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  border: string;
  input: string;
  ring: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;
  /** Not a CSS variable: `text-gray-900` used by SectionCard/PageHeader titles. */
  heading: string;
  /** Not a CSS variable: literal series colours in pages/Admin/Dashboard.tsx. */
  seriesAbsent: string;
  seriesRanAway: string;
}

/** `:root` in dashboard/src/index.css (the only theme the dashboard ships today). */
export const lightColors: ThemeColors = {
  background: '#ffffff',
  foreground: '#0f172a',
  card: '#ffffff',
  cardForeground: '#0f172a',
  popover: '#ffffff',
  popoverForeground: '#0f172a',
  primary: '#0f172a',
  primaryForeground: '#ffffff',
  secondary: '#f1f5f9',
  secondaryForeground: '#0f172a',
  muted: '#f1f5f9',
  mutedForeground: '#64748b',
  accent: '#f1f5f9',
  accentForeground: '#0f172a',
  destructive: '#e7000b', // oklch(0.577 0.245 27.325)
  border: '#e2e8f0',
  input: '#f1f5f9',
  ring: '#0f172a',
  chart1: '#0f172a',
  chart2: '#0f172a',
  chart3: '#0f172a',
  chart4: '#0f172a',
  chart5: '#0f172a',
  sidebar: '#ffffff',
  sidebarForeground: '#0f172a',
  sidebarPrimary: '#0f172a',
  sidebarPrimaryForeground: '#ffffff',
  sidebarAccent: '#f1f5f9',
  sidebarAccentForeground: '#0f172a',
  sidebarBorder: '#e2e8f0',
  sidebarRing: '#0f172a',
  heading: tw.gray900,
  seriesAbsent: '#dc2626',
  seriesRanAway: '#d97706',
};

/**
 * `.dark` in dashboard/src/index.css. Ported for completeness but NOT enabled: the dashboard's
 * theme switch is commented out (dashboard/index.html, dashboard/src/main.tsx), so it always
 * renders light. Enable together with the web dashboard.
 */
export const darkColors: ThemeColors = {
  background: '#011627',
  foreground: '#f8fafc',
  card: '#01243d',
  cardForeground: '#f8fafc',
  popover: '#01243d',
  popoverForeground: '#f8fafc',
  primary: '#237299',
  primaryForeground: '#ffffff',
  secondary: '#07566e',
  secondaryForeground: '#ffffff',
  muted: '#01365a',
  mutedForeground: '#94a3b8',
  accent: '#177587',
  accentForeground: '#ffffff',
  destructive: '#ff6467', // oklch(0.704 0.191 22.216)
  border: 'rgba(255, 255, 255, 0.1)',
  input: '#01365a',
  ring: '#237299',
  chart1: '#237299',
  chart2: '#177587',
  chart3: '#8acffd',
  chart4: '#3fc4de',
  chart5: '#9ae0ed',
  sidebar: '#01243d',
  sidebarForeground: '#f8fafc',
  sidebarPrimary: '#237299',
  sidebarPrimaryForeground: '#ffffff',
  sidebarAccent: '#01365a',
  sidebarAccentForeground: '#f8fafc',
  sidebarBorder: 'rgba(255, 255, 255, 0.1)',
  sidebarRing: '#237299',
  heading: '#ffffff',
  seriesAbsent: '#dc2626',
  seriesRanAway: '#d97706',
};

/** `--radius: 0.66rem` (10.56px) and the shadcn derived radii from `@theme inline`. */
const RADIUS = 0.66 * 16;
export const radii = {
  sm: RADIUS - 4, // rounded-sm: buttons, nav items
  md: RADIUS - 2, // rounded-md
  lg: RADIUS, // rounded-lg: inputs, segmented control
  xl: RADIUS + 4, // rounded-xl: cards
  /** Tailwind's fixed `rounded` (0.25rem), used by status chips and avatars. */
  base: 4,
  full: 9999,
} as const;

/** Tailwind v4 text scale: [font-size, line-height] in px. */
export const fontSizes = {
  xs: { fontSize: 12, lineHeight: 16 },
  sm: { fontSize: 14, lineHeight: 20 },
  base: { fontSize: 16, lineHeight: 24 },
  lg: { fontSize: 18, lineHeight: 28 },
  xl: { fontSize: 20, lineHeight: 28 },
  '2xl': { fontSize: 24, lineHeight: 32 },
} as const;
export type FontSize = keyof typeof fontSizes;

export type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold';

/**
 * The dashboard renders Latin text in Outfit (dashboard/public/fonts/Outfit.woff2) and Bangla in
 * SolaimanLipi via one `MixedFont` face. Outfit is loaded here from @expo-google-fonts/outfit
 * (static TTFs, which native needs); each weight is its own family on React Native.
 */
export const fontFamilies: Record<FontWeight, string> = {
  regular: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semibold: 'Outfit_600SemiBold',
  bold: 'Outfit_700Bold',
};

/** `tracking-wider` = 0.05em; RN needs absolute px, so multiply by the font size. */
export const trackingWider = (fontSize: number) => fontSize * 0.05;

/** Tailwind v4 shadows as CSS box-shadow strings (RN `boxShadow` supports them on all targets). */
export const shadows = {
  xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  /** Sidebar edge: `shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)]`. */
  sidebar: '4px 0 8px -4px rgba(0, 0, 0, 0.08)',
  /** Native <select> picker / dropdown panels in index.css. */
  popover: '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.05)',
} as const;

/** Tailwind spacing (0.25rem steps), named by class suffix. */
export const space = (n: number) => n * 4;

/** Tailwind default breakpoints used by the dashboard layout. */
export const breakpoints = {
  sm: 640,
  md: 768, // sidebar becomes persistent (App.tsx / Sidebar.tsx)
  lg: 1024, // overview grids go multi-column
  xl: 1280,
} as const;

export const layout = {
  /** Navbar `h-[3.5rem]`. */
  navbarHeight: 56,
  /** Expanded sidebar width in Sidebar.tsx. */
  sidebarWidth: 250,
  /** Bottom tab bar (Expo-only mobile pattern; the web dashboard uses a burger drawer). */
  bottomBarHeight: 64,
  /** `max-w-7xl`. */
  contentMaxWidth: 1280,
} as const;

export interface Theme {
  colors: ThemeColors;
  radii: typeof radii;
  fontSizes: typeof fontSizes;
  fontFamilies: typeof fontFamilies;
  shadows: typeof shadows;
  layout: typeof layout;
  scheme: 'light' | 'dark';
}

export const defaultTheme: Theme = {
  colors: lightColors,
  radii,
  fontSizes,
  fontFamilies,
  shadows,
  layout,
  scheme: 'light',
};

/** Append an alpha channel to a #rrggbb colour, e.g. Tailwind `bg-blue-500/10`. */
export function withAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}

/** `#rrggbb` -> `"r g b"`, the channel format of the CSS variables in global.css. */
export function hexToRgbChannels(hex: string): string | null {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  const n = Number.parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}
