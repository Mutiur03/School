/**
 * Runtime configuration. Expo inlines `process.env.EXPO_PUBLIC_*` at build time, so each value
 * must be read with a literal property access. These values are public (they ship in the
 * bundle); secrets never belong here.
 */
import { Platform } from 'react-native';
import { buildAppConfig, type AppConfig, type ConfigIssue } from './build-config';

const built = buildAppConfig(
  {
    appEnv: process.env.EXPO_PUBLIC_APP_ENV,
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    cdnUrl: process.env.EXPO_PUBLIC_CDN_URL,
    devTenantHost: process.env.EXPO_PUBLIC_DEV_TENANT_HOST,
  },
  Platform.OS,
);

export const appConfig: AppConfig = built.config;
export const configIssues: readonly ConfigIssue[] = built.issues;
export type { AppConfig, AppEnv, ConfigIssue } from './build-config';
