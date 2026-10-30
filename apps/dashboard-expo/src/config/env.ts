/**
 * Runtime configuration. Expo inlines `process.env.EXPO_PUBLIC_*` at build time, so each value
 * must be read with a literal property access. These values are public (they ship in the
 * bundle); secrets never belong here.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { buildAppConfig, type AppConfig, type ConfigIssue } from './build-config';

const LOCAL_SERVER_PORT = 3002;

// Local dev on a device: the API runs on the machine serving Metro, so reuse Metro's host.
const metroHost = Constants.expoConfig?.hostUri?.split(':')[0];
const localDirectoryUrl =
  process.env.EXPO_PUBLIC_APP_ENV === 'local' && Platform.OS !== 'web' && metroHost
    ? `http://${metroHost}:${LOCAL_SERVER_PORT}`
    : undefined;

const built = buildAppConfig(
  {
    appEnv: process.env.EXPO_PUBLIC_APP_ENV,
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    directoryUrl: process.env.EXPO_PUBLIC_DIRECTORY_URL || localDirectoryUrl,
    cdnUrl: process.env.EXPO_PUBLIC_CDN_URL,
    devTenantHost: process.env.EXPO_PUBLIC_DEV_TENANT_HOST,
    appRole: process.env.EXPO_PUBLIC_APP_ROLE,
  },
  Platform.OS,
);

export const appConfig: AppConfig = built.config;
export const configIssues: readonly ConfigIssue[] = built.issues;
export type { AppConfig, AppEnv, ConfigIssue } from './build-config';
