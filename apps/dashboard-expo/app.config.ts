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

// Public EAS identifiers (not secrets). Overridable for forks or a different Expo account.
const EAS_OWNER = process.env.EAS_OWNER ?? 'mutiur03';
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID ?? '52513465-21b2-46d6-bac4-93bbc2892291';

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
    owner: EAS_OWNER,
    scheme: variant.scheme,
    version: '0.1.0',
    orientation: 'default',
    // Light only, like the web dashboard (its dark theme is defined but switched off). NativeWind
    // follows the system scheme; change to 'automatic' together with enabling `.dark`.
    userInterfaceStyle: 'light',
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
    plugins: [
      'expo-router',
      'expo-status-bar',
      'expo-secure-store',
      'expo-font',
      [
        'expo-camera',
        {
          // QR scanning only: no microphone / RECORD_AUDIO permission.
          cameraPermission: "Allow $(PRODUCT_NAME) to scan your school's QR code.",
          microphonePermission: false,
          recordAudioAndroid: false,
        },
      ],
      // Uploads (notices, PDFs, photos, spreadsheets). The system photo picker needs no library
      // permission on Android 13+ / iOS 14+; the text covers older systems. No microphone.
      [
        'expo-image-picker',
        {
          photosPermission:
            'Allow $(PRODUCT_NAME) to use your photos so you can upload student, staff and gallery pictures.',
          // Same text as expo-camera above (the first plugin's text is the one that ships).
          cameraPermission: "Allow $(PRODUCT_NAME) to scan your school's QR code.",
          microphonePermission: false,
        },
      ],
      'expo-document-picker',
      '@react-native-community/datetimepicker',
    ],
    experiments: {
      typedRoutes: true,
    },
    // OTA: binaries only accept updates whose native fingerprint matches theirs. The app checks on
    // every launch and starts immediately from what it has; a downloaded update applies on the
    // next cold start. Publish with `pnpm update:staging` (see README). Never the production channel
    // without sign-off.
    updates: {
      url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 0,
    },
    runtimeVersion: { policy: 'fingerprint' },
    extra: {
      appEnv,
      eas: { projectId: EAS_PROJECT_ID },
    },
  };
};
