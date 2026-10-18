/**
 * Pure config parsing (no React Native imports) so it can be unit-tested under Node.
 * `src/config/env.ts` feeds it the inlined EXPO_PUBLIC_* values.
 */
export type AppEnv = 'local' | 'staging' | 'production';
export type RuntimePlatform = 'web' | 'ios' | 'android' | (string & {});

export interface AppConfig {
  appEnv: AppEnv;
  /** API origin without `/api`. Empty string means same-origin (web only). */
  apiBaseUrl: string;
  /** Public CDN origin used for stored R2 keys. Empty when not configured. */
  cdnUrl: string;
  /** Dev-only `x-tenant-host` override; always null outside `local`. */
  devTenantHost: string | null;
  platform: RuntimePlatform;
}

export interface ConfigIssue {
  key: string;
  message: string;
}

export interface RawPublicEnv {
  appEnv?: string;
  apiBaseUrl?: string;
  cdnUrl?: string;
  devTenantHost?: string;
}

const APP_ENVS: readonly AppEnv[] = ['local', 'staging', 'production'];

const trimTrailingSlashes = (value: string) => value.trim().replace(/\/+$/, '');

export function parseAppEnv(raw: string | undefined): AppEnv {
  return raw && (APP_ENVS as readonly string[]).includes(raw) ? (raw as AppEnv) : 'local';
}

export function buildAppConfig(
  raw: RawPublicEnv,
  platform: RuntimePlatform,
): { config: AppConfig; issues: ConfigIssue[] } {
  const appEnv = parseAppEnv(raw.appEnv);
  // Accept a value that mistakenly includes /api; every request path already starts with /api.
  const apiBaseUrl = trimTrailingSlashes(raw.apiBaseUrl ?? '').replace(/\/api$/, '');
  const cdnUrl = trimTrailingSlashes(raw.cdnUrl ?? '');
  const devTenantHost =
    appEnv === 'local' && raw.devTenantHost?.trim() ? raw.devTenantHost.trim().toLowerCase() : null;

  const issues: ConfigIssue[] = [];
  if (platform !== 'web' && !apiBaseUrl) {
    issues.push({
      key: 'EXPO_PUBLIC_API_BASE_URL',
      message: 'Native builds have no page origin. Set it to a school dashboard host.',
    });
  }
  if (apiBaseUrl && !/^https?:\/\/[^/]+$/.test(apiBaseUrl)) {
    issues.push({
      key: 'EXPO_PUBLIC_API_BASE_URL',
      message: 'Must be an http(s) origin with no path, e.g. https://school-dashboard.example.com',
    });
  }
  if (appEnv !== 'local' && apiBaseUrl.startsWith('http://')) {
    issues.push({
      key: 'EXPO_PUBLIC_API_BASE_URL',
      message: 'Staging and production builds must use https.',
    });
  }

  return { config: { appEnv, apiBaseUrl, cdnUrl, devTenantHost, platform }, issues };
}
