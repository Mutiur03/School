import type { SMSMessage, SMSResponse } from '@/utils/sms.service.js';

export interface SmsProviderCreds {
  apiKey: string;
  apiUrl?: string | null;
  senderId: string;
}

export interface SmsProviderResult extends SMSResponse {
  unitsUsed?: number;
}

export interface SmsBalanceResult {
  success: boolean;
  /** Estimated number of SMS the provider's current balance can still send. */
  estimatedSms?: number;
  message?: string;
}

export interface SmsProviderAdapter {
  send(messages: SMSMessage[], creds: SmsProviderCreds): Promise<SmsProviderResult>;
  /** Live balance from the provider's own API. Omit for providers with no balance endpoint. */
  getBalance?(creds: Pick<SmsProviderCreds, 'apiKey' | 'apiUrl'>): Promise<SmsBalanceResult>;
}
