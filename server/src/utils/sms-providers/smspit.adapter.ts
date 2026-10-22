import { calculateSMSCount } from '@school/shared-schemas';
import type { SMSMessage } from '@/utils/sms.service.js';
import type { SmsProviderAdapter, SmsProviderCreds, SmsProviderResult } from './types.js';

/** smspitt generic capture endpoint. UI is :2875, this API is :2876. */
const DEFAULT_URL = 'http://127.0.0.1:2876/generic';

export const smspitAdapter: SmsProviderAdapter = {
  async send(messages: SMSMessage[], creds: SmsProviderCreds): Promise<SmsProviderResult> {
    const url = creds.apiUrl || DEFAULT_URL;
    let unitsUsed = 0;
    // Same shape as the real provider's `data.results`, one entry per message in order. Without it
    // the callers treat the send as undelivered and never set attendence.send_msg.
    const results: { status: string; message_id: string; sms_count: number }[] = [];
    try {
      for (const msg of messages) {
        const res = await fetch(url, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: msg.Number.startsWith('+') ? msg.Number : `+${msg.Number}`,
            from: creds.senderId,
            message: msg.Text,
          }),
        });
        const data: { message?: string; id?: string } = await res.json().catch(() => ({}));
        if (!res.ok) {
          return {
            success: false,
            message: data?.message || `SMSPit rejected the message (${res.status})`,
          };
        }
        const count = calculateSMSCount(msg.Text).count;
        unitsUsed += count;
        results.push({ status: 'sent', message_id: data?.id ?? '', sms_count: count });
      }
      return { success: true, data: { results }, message: 'SMS captured by SMSPit', unitsUsed };
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : 'request failed';
      return { success: false, message: `SMSPit is not reachable at ${url}: ${detail}` };
    }
  },
};
