/**
 * Tailwind v3 config for NativeWind v4. Mirrors the web dashboard's Tailwind v4 theme
 * (dashboard/src/index.css `@theme inline`) so class names mean the same thing in both apps:
 * shadcn colours read the CSS variables in global.css, radii derive from --radius (0.66rem),
 * and the palette is Tailwind v4's (tailwind.palette.js) rather than v3's.
 */
const plugin = require('tailwindcss/plugin');
const palette = require('./tailwind.palette');

const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const RADIUS = 0.66 * 16; // --radius: 0.66rem

// React Native has one font family per weight (Outfit_600SemiBold, ...) and setting fontWeight
// alongside a custom family breaks Android. So `font-medium`/`font-semibold`/... select the
// matching Outfit family instead of a weight; class names stay identical to the dashboard.
const OUTFIT = {
  normal: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semibold: 'Outfit_600SemiBold',
  bold: 'Outfit_700Bold',
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  corePlugins: { fontWeight: false },
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#ffffff',
      black: '#000000',
      ...palette,
      background: v('background'),
      foreground: v('foreground'),
      card: { DEFAULT: v('card'), foreground: v('card-foreground') },
      popover: { DEFAULT: v('popover'), foreground: v('popover-foreground') },
      primary: { DEFAULT: v('primary'), foreground: v('primary-foreground') },
      secondary: { DEFAULT: v('secondary'), foreground: v('secondary-foreground') },
      muted: { DEFAULT: v('muted'), foreground: v('muted-foreground') },
      accent: { DEFAULT: v('accent'), foreground: v('accent-foreground') },
      destructive: v('destructive'),
      border: v('border'),
      input: v('input'),
      ring: v('ring'),
      chart: {
        1: v('chart-1'),
        2: v('chart-2'),
        3: v('chart-3'),
        4: v('chart-4'),
        5: v('chart-5'),
      },
      sidebar: {
        DEFAULT: v('sidebar'),
        foreground: v('sidebar-foreground'),
        primary: v('sidebar-primary'),
        'primary-foreground': v('sidebar-primary-foreground'),
        accent: v('sidebar-accent'),
        'accent-foreground': v('sidebar-accent-foreground'),
        border: v('sidebar-border'),
        ring: v('sidebar-ring'),
      },
      // Literal series colours in dashboard/src/pages/Admin/Dashboard.tsx.
      series: { absent: '#dc2626', 'ran-away': '#d97706' },
    },
    extend: {
      borderRadius: {
        sm: `${RADIUS - 4}px`,
        md: `${RADIUS - 2}px`,
        lg: `${RADIUS}px`,
        xl: `${RADIUS + 4}px`,
      },
      fontFamily: { sans: [OUTFIT.normal] },
      maxWidth: { '7xl': '1280px' },
    },
  },
  plugins: [
    plugin(({ addUtilities }) => {
      addUtilities(
        Object.fromEntries(
          Object.entries(OUTFIT).map(([k, family]) => [`.font-${k}`, { fontFamily: family }]),
        ),
      );
    }),
  ],
};
