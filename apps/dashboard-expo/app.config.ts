import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Build-time app config. `APP_ENV` selects the variant (local | staging | production) and is set
 * by the EAS build profile (eas.json) or the shell. Runtime values the JS bundle needs are read
 * from EXPO_PUBLIC_* variables in src/config/env.ts. Never put secrets in either place: everything
 * here and every EXPO_PUBLIC_* value ends up inside the shipped app.
 */
type AppEnv = 'local' | 'staging' | 'production';

const APP_ENVS: readonly AppEnv[] = ['local', 'staging', 'production'];
const rawAppEnv = process.env.APP_ENV ?? process.env.EXPO_PUBLIC_APP_ENV ?? 'local';
const appEnv: AppEnv = (APP_ENVS as readonly string[]).includes(rawAppEnv)
  ? (rawAppEnv as AppEnv)
  : 'local';

// Placeholder identifier. Confirm the final reverse-DNS id before the first store build:
// it cannot be changed after an app is published.
const BASE_APP_ID = 'com.mutiurrahman.schooldashboard';

const VARIANTS: Record<AppEnv, { name: string; idSuffix: string; scheme: string }> = {
  local: { name: 'School Dashboard (Dev)', idSuffix: '.dev', scheme: 'schooldashboard-dev' },
  staging: {
    name: 'School Dashboard (Staging)',
    idSuffix: '.staging',
    scheme: 'schooldashboard-stg',
  },
  production: { name: 'School Dashboard', idSuffix: '', scheme: 'schooldashboard' },
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = VARIANTS[appEnv];
  const appId = `${BASE_APP_ID}${variant.idSuffix}`;

  return {
    ...config,
    name: variant.name,
    slug: 'school-dashboard',
    scheme: variant.scheme,
    version: '0.1.0',
    orientation: 'default',
    // Launcher icon is static and platform-wide. Per-school logos are in-app branding only
    // (src/tenant) and are never written into the native icon.
    icon: './assets/icon.png',
    ios: {
      bundleIdentifier: appId,
      supportsTablet: true,
    },
    android: {
      package: appId,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#1E3A8A',
      },
    },
    web: {
      bundler: 'metro',
      output: 'single',
      favicon: './assets/favicon.png',
    },
    plugins: ['expo-router', 'expo-status-bar', 'expo-secure-store', 'expo-font'],
    experiments: {
      typedRoutes: true,
    },
    // OTA updates only reach binaries with an identical native fingerprint. expo-updates and an
    // EAS project id are not configured yet, so nothing can be published from this repo today.
    runtimeVersion: { policy: 'fingerprint' },
    extra: {
      appEnv,
    },
  };
};
