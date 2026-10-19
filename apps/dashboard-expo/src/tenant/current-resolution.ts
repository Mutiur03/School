import { Platform } from 'react-native';
import { appConfig } from '@/config/env';
import type { PlatformSelection, SchoolSelection } from '@/school/selection';
import {
  resolveTenant,
  tenantConnection,
  type TenantConnection,
  type TenantResolution,
} from './resolve';

/** Resolution for this app instance. On web the page host is fixed for the page's lifetime. */
export function getCurrentTenantResolution(
  selection: SchoolSelection | null,
  platform: PlatformSelection | null = null,
): {
  resolution: TenantResolution;
  connection: TenantConnection;
} {
  const pageHost =
    Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.host : null;
  const resolution = resolveTenant({
    platform: Platform.OS,
    pageHost,
    apiBaseUrl: appConfig.apiBaseUrl,
    devTenantHost: appConfig.devTenantHost,
    selectedHost: selection?.host ?? null,
    platformHost: platform?.host ?? null,
  });
  return {
    resolution,
    connection: tenantConnection(resolution, appConfig, selection?.apiBaseUrl ?? null),
  };
}
