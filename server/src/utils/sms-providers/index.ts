import type { SmsProviderAdapter } from './types.js';
import { onecodeAdapter } from './onecode.adapter.js';
import { smspitAdapter } from './smspit.adapter.js';

export type { SmsProviderAdapter, SmsProviderCreds, SmsProviderResult } from './types.js';

const PROVIDER_ADAPTERS: Record<string, SmsProviderAdapter> = {
  onecode: onecodeAdapter,
  smspit: smspitAdapter,
};

const DEFAULT_PROVIDER = 'onecode';

export function getProviderAdapter(serviceType?: string | null): SmsProviderAdapter {
  const key = serviceType?.trim() || DEFAULT_PROVIDER;
  const adapter = PROVIDER_ADAPTERS[key];
  if (!adapter) {
    throw new Error(
      `Unknown SMS provider "${key}". Supported providers: ${Object.keys(PROVIDER_ADAPTERS).join(', ')}`,
    );
  }
  return adapter;
}
