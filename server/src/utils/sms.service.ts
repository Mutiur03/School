import { env } from "@/config/env.js";
import { prisma } from "@/config/prisma.js";
import axios from "axios";
import { calculateSMSCount } from "@school/shared-schemas";

export interface SMSMessage {
  Number: string;
  Text: string;
}

export interface SMSResponse {
  success: boolean;
  message?: string;
  data?: any;
}

export class SMSService {
  private static readonly FALLBACK_API_KEY = env.BULK_SMS_API_KEY;
  private static readonly FALLBACK_SENDER_ID = env.BULK_SMS_SENDER_ID;
  private static readonly DEFAULT_API_URL = "https://sms.onecodesoft.com/api/send-bulk-sms";

  public static formatPhoneNumber(phoneNumber: string): string {
    const cleanNumber = phoneNumber.replace(/\D/g, "");
    if (cleanNumber.length === 11 && cleanNumber.startsWith("01")) {
      return `88${cleanNumber}`;
    }
    if (cleanNumber.length === 13 && cleanNumber.startsWith("8801")) {
      return cleanNumber;
    }
    // Fallback: if it's already 13 and looks like international, or if it's just 11
    return cleanNumber.startsWith("88") ? cleanNumber : `88${cleanNumber}`;
  }

  public static async getSettings() {
    let settings = await prisma.sms_settings.findFirst();
    if (!settings) {
      settings = await prisma.sms_settings.create({
        data: {},
      });
    }
    return settings;
  }

  /**
   * Send a single SMS message
   */
  static async sendSMS(phoneNumber: string, message: string): Promise<SMSResponse> {
    const settings = await this.getSettings();
    const apiKey = settings.api_key || this.FALLBACK_API_KEY;
    const senderId = settings.sender_id || this.FALLBACK_SENDER_ID;
    const apiUrl = settings.api_url || this.DEFAULT_API_URL;

    if (!apiKey || !senderId) {
      throw new Error("SMS configuration missing in database and environment.");
    }

    const calc = this.calculateSMSCount(message);
    if (settings.sms_balance < calc.count) {
      return {
        success: false,
        message: `Insufficient SMS balance. Needed: ${calc.count} credits, Available: ${settings.sms_balance}`,
      };
    }

    const messageParameters: SMSMessage[] = [
      {
        Number: SMSService.formatPhoneNumber(phoneNumber),
        Text: message,
      },
    ];

    try {
      const response = await axios.post(
        apiUrl,
        {
          api_key: apiKey,
          senderid: senderId,
          MessageParameters: messageParameters,
        },
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );
      console.log(response.data);

      // Sum up sms_count from results if available
      let totalSmsUsed = 0;
      if (response.data?.results && Array.isArray(response.data.results)) {
        totalSmsUsed = response.data.results.reduce((sum: number, res: any) => sum + (res.sms_count || 0), 0);
      }
      
      // Fallback if results are empty but top level has something
      if (totalSmsUsed === 0) {
        totalSmsUsed = response.data?.total_sms || response.data?.sms_count || 1;
      }

      await prisma.sms_settings.update({
        where: { id: settings.id },
        data: {
          sms_balance: {
            decrement: totalSmsUsed
          }
        }
      });

      return {
        success: true,
        data: response.data,
        message: "SMS sent successfully",
      };
    } catch (error: any) {
      console.error("SMS sending error:", error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || "Failed to send SMS",
      };
    }
  }

  /**
   * Send bulk SMS messages
   */
  static async sendBulkSMS(messages: SMSMessage[]): Promise<SMSResponse> {
    const settings = await this.getSettings();
    const apiKey = settings.api_key || this.FALLBACK_API_KEY;
    const senderId = settings.sender_id || this.FALLBACK_SENDER_ID;
    const apiUrl = settings.api_url || this.DEFAULT_API_URL;

    if (!apiKey || !senderId) {
      throw new Error("SMS configuration missing.");
    }

    // Calculate aggregate segments needed for the ENTIRE batch
    let totalSegmentsNeeded = 0;
    for (const msg of messages) {
      const calc = this.calculateSMSCount(msg.Text);
      totalSegmentsNeeded += calc.count;
    }

    if (settings.sms_balance < totalSegmentsNeeded) {
      return {
        success: false,
        message: `Insufficient SMS balance. Needed: ${totalSegmentsNeeded} credits, Available: ${settings.sms_balance}`,
      };
    }

    const messageParameters = messages.map(msg => ({
      Number: SMSService.formatPhoneNumber(msg.Number),
      Text: msg.Text,
    }));

    try {
      const response = await axios.post(
        apiUrl,
        {
          api_key: apiKey,
          senderid: senderId,
          MessageParameters: messageParameters,
        },
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );
      console.log(response.data);
      let totalSmsUsed = 0;
      if (response.data?.results && Array.isArray(response.data.results)) {
        totalSmsUsed = response.data.results.reduce((sum: number, res: any) => sum + (res.sms_count || 0), 0);
      }
      if (totalSmsUsed === 0) {
        totalSmsUsed = response.data?.total_sms || response.data?.sms_count || totalSegmentsNeeded;
      }

      await prisma.sms_settings.update({
        where: { id: settings.id },
        data: {
          sms_balance: {
            decrement: totalSmsUsed
          }
        }
      });

      return {
        success: true,
        data: response.data,
        message: "Bulk SMS sent successfully",
      };
    } catch (error: any) {
      console.error("Bulk SMS sending error:", error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || "Failed to send bulk SMS",
      };
    }
  }

  /**
   * Get SMS Balance
   */
  static async getBalance(): Promise<SMSResponse> {
    const settings = await this.getSettings();
    return {
      success: true,
      data: { balance: settings.sms_balance },
      message: "Balance retrieved from database",
    };
  }

  /**
   * Calculate SMS count based on text length and encoding
   */
  static calculateSMSCount(text: string): { count: number; encoding: "GSM-7" | "Unicode"; length: number } {
    return calculateSMSCount(text);
  }

  /**
   * Send a test SMS message
   */
  static async sendTestSMS(phoneNumber: string, message: string): Promise<SMSResponse> {
    const testMessage = `[TEST] School Management System: ${message}`;
    return this.sendSMS(phoneNumber, testMessage);
  }

  /**
   * Send password reset code
   */
  static async sendPasswordResetCode(phoneNumber: string, resetCode: string, recipientName?: string): Promise<SMSResponse> {
    const message = `School Management System: Your password reset code is: ${resetCode}. This code will expire in 15 minutes. If you didn't request this, please ignore this message.${recipientName ? ` - ${recipientName}` : ''}`;
    
    return this.sendSMS(phoneNumber, message);
  }

  // /**
  //  * Send verification code
  //  */
  // static async sendVerificationCode(phoneNumber: string, verificationCode: string, purpose: string): Promise<SMSResponse> {
  //   const message = `School Management System: Your ${purpose} verification code is: ${verificationCode}. This code will expire in 10 minutes. If you didn't request this, please ignore this message.`;
    
  //   return this.sendSMS(phoneNumber, message);
  // }

  // /**
  //  * Send general notification
  //  */
  // static async sendNotification(phoneNumber: string, notification: string): Promise<SMSResponse> {
  //   const message = `School Management System: ${notification}`;
    
  //   return this.sendSMS(phoneNumber, message);
  // }

  // /**
  //  * Validate phone number format (Bangladesh)
  //  */
  // static validatePhoneNumber(phoneNumber: string): boolean {
  //   // Remove any non-digit characters
  //   const cleanNumber = phoneNumber.replace(/\D/g, '');
    
  //   // Check if it's a valid Bangladesh number (11 digits starting with 01)
  //   return cleanNumber.length === 11 && cleanNumber.startsWith('01');
  // }

  // /**
  //  * Format phone number to standard format
  //  */
  // static formatPhoneNumber(phoneNumber: string): string {
  //   const cleanNumber = phoneNumber.replace(/\D/g, '');
    
  //   if (cleanNumber.length === 11 && cleanNumber.startsWith('01')) {
  //     return cleanNumber;
  //   }
    
  //   throw new Error('Invalid phone number format. Must be 11 digits starting with 01');
  // }
}

