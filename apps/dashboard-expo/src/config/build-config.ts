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
  /** Origin for the pre-login school-code lookup. Falls back to apiBaseUrl, then same-origin. */
  directoryUrl: string;
  /**
   * Platform (super-admin) origin. Always directoryUrl: the directory is the super-admin Worker
   * host, the one neutral host not tied to a school. Empty = platform sign-in is hidden.
   */
  superAdminUrl: string;
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
  directoryUrl?: string;
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
  const directoryUrl =
    trimTrailingSlashes(raw.directoryUrl ?? '').replace(/\/api$/, '') || apiBaseUrl;
  const superAdminUrl = directoryUrl;
  const cdnUrl = trimTrailingSlashes(raw.cdnUrl ?? '');
  const devTenantHost =
    appEnv === 'local' && raw.devTenantHost?.trim() ? raw.devTenantHost.trim().toLowerCase() : null;

  const issues: ConfigIssue[] = [];
  if (platform !== 'web' && !apiBaseUrl && !directoryUrl) {
    issues.push({
      key: 'EXPO_PUBLIC_DIRECTORY_URL',
      message:
        'Native builds have no page origin. Set EXPO_PUBLIC_DIRECTORY_URL (school-code lookup) or pin EXPO_PUBLIC_API_BASE_URL to a school dashboard host.',
    });
  }
  for (const [key, value] of [
    ['EXPO_PUBLIC_API_BASE_URL', apiBaseUrl],
    ['EXPO_PUBLIC_DIRECTORY_URL', directoryUrl],
  ] as const) {
    if (value && !/^https?:\/\/[^/]+$/.test(value)) {
      issues.push({
        key,
        message:
          'Must be an http(s) origin with no path, e.g. https://school-dashboard.example.com',
      });
    }
    if (appEnv !== 'local' && value.startsWith('http://')) {
      issues.push({ key, message: 'Staging and production builds must use https.' });
    }
  }

  return {
    config: { appEnv, apiBaseUrl, directoryUrl, superAdminUrl, cdnUrl, devTenantHost, platform },
    // The same bad value reported for both keys once is enough.
    issues: issues.filter(
      (issue, i) =>
        issues.findIndex((o) => o.message === issue.message && o.key === issue.key) === i,
    ),
  };
}
