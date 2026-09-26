import type { SmsProviderAdapter } from './types.js';
import { onecodeAdapter } from './onecode.adapter.js';

export type { SmsProviderAdapter, SmsProviderCreds, SmsProviderResult } from './types.js';

export const SMS_SERVICE_TYPES = ['onecode'] as const;
export type SmsServiceType = (typeof SMS_SERVICE_TYPES)[number];

const PROVIDER_ADAPTERS: Record<SmsServiceType, SmsProviderAdapter> = {
  onecode: onecodeAdapter,
};

const DEFAULT_PROVIDER = 'onecode';

function isSmsServiceType(value: string): value is SmsServiceType {
  return (SMS_SERVICE_TYPES as readonly string[]).includes(value);
}

export function getProviderAdapter(serviceType?: string | null): SmsProviderAdapter {
  const key = serviceType?.trim() || DEFAULT_PROVIDER;
  if (!isSmsServiceType(key)) {
    throw new Error(
      `Unknown SMS provider "${key}". Supported providers: ${SMS_SERVICE_TYPES.join(', ')}`,
    );
  }
  return PROVIDER_ADAPTERS[key];
}
