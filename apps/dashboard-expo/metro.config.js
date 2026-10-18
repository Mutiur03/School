// Expo's default config (monorepo-aware: watches the workspace root and packages/*) plus
// NativeWind, which compiles global.css + tailwind.config.js for web and native.
// inlineRem: 16 makes 1rem = 16px on native like the browser (NativeWind defaults to 14), so
// `p-4`, `text-sm`, etc. have the same pixel sizes as in the web dashboard.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

module.exports = withNativeWind(getDefaultConfig(__dirname), {
  input: './global.css',
  inlineRem: 16,
});
