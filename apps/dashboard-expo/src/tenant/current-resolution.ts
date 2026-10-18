import { Platform } from 'react-native';
import { appConfig } from '@/config/env';
import { resolveTenant, type TenantResolution } from './resolve';

/** Resolution for this app instance. On web the page host is fixed for the page's lifetime. */
export function getCurrentTenantResolution(): TenantResolution {
  const pageHost =
    Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.host : null;
  return resolveTenant({
    platform: Platform.OS,
    pageHost,
    apiBaseUrl: appConfig.apiBaseUrl,
    devTenantHost: appConfig.devTenantHost,
  });
}
