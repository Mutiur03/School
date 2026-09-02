import type {
  SmsProviderAdapter,
  SmsProviderCreds,
  SmsProviderResult,
  SmsBalanceResult,
} from './types.js';
import type { SMSMessage } from '@/utils/sms.service.js';

const DEFAULT_API_URL = 'https://sms.onecodesoft.com/api/send-bulk-sms';
const BALANCE_API_URL = 'https://sms.ocs-api.top/api/get-balance';

export const onecodeAdapter: SmsProviderAdapter = {
  async send(messages: SMSMessage[], creds: SmsProviderCreds): Promise<SmsProviderResult> {
    const apiUrl = creds.apiUrl || DEFAULT_API_URL;

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: creds.apiKey,
          senderid: creds.senderId,
          MessageParameters: messages,
        }),
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          success: false,
          message: data?.message || `Failed to send SMS via OneCode (${res.status})`,
        };
      }
      console.log(data);

      let unitsUsed = 0;
      if (data?.results && Array.isArray(data.results)) {
        unitsUsed = data.results.reduce((sum: number, row: any) => sum + (row.sms_count || 0), 0);
      }
      if (unitsUsed === 0) {
        unitsUsed = data?.total_sms || data?.sms_count || messages.length;
      }

      return {
        success: true,
        data,
        message: 'SMS sent successfully',
        unitsUsed,
      };
    } catch (error: any) {
      console.error('OneCode SMS sending error:', error);
      return {
        success: false,
        message: error.message || 'Failed to send SMS',
      };
    }
  },

  async getBalance(creds): Promise<SmsBalanceResult> {
    try {
      const url = `${BALANCE_API_URL}?api_key=${encodeURIComponent(creds.apiKey)}`;
      const res = await fetch(url);
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          success: false,
          message: data?.message || `Failed to fetch OneCode balance (${res.status})`,
        };
      }
      const estimatedSms = Number(data?.estimate_sms);
      return {
        success: true,
        estimatedSms: Number.isFinite(estimatedSms) ? estimatedSms : 0,
      };
    } catch (error: any) {
      console.error('OneCode balance fetch error:', error);
      return {
        success: false,
        message: error.message || 'Failed to fetch balance',
      };
    }
  },
};
