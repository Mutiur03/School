import axios from "axios";

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
  private static readonly API_KEY = process.env.BULK_SMS_API_KEY;
  private static readonly SENDER_ID = process.env.BULK_SMS_SENDER_ID;
  private static readonly API_URL = "https://sms.onecodesoft.com/api/send-bulk-sms";

  /**
   * Send a single SMS message
   */
  static async sendSMS(phoneNumber: string, message: string): Promise<SMSResponse> {
    if (!this.API_KEY || !this.SENDER_ID) {
      throw new Error("SMS configuration missing. Please check BULK_SMS_API_KEY and BULK_SMS_SENDER_ID environment variables.");
    }

    const messageParameters: SMSMessage[] = [
      {
        Number: `88${phoneNumber}`, // Bangladesh country code
        Text: message,
      },
    ];

    try {
      const response = await axios.post(
        this.API_URL,
        {
          api_key: this.API_KEY,
          senderid: this.SENDER_ID,
          MessageParameters: messageParameters,
        },
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

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
    if (!this.API_KEY || !this.SENDER_ID) {
      throw new Error("SMS configuration missing. Please check BULK_SMS_API_KEY and BULK_SMS_SENDER_ID environment variables.");
    }

    const messageParameters = messages.map(msg => ({
      Number: msg.Number.startsWith('88') ? msg.Number : `88${msg.Number}`,
      Text: msg.Text,
    }));

    try {
      const response = await axios.post(
        this.API_URL,
        {
          api_key: this.API_KEY,
          senderid: this.SENDER_ID,
          MessageParameters: messageParameters,
        },
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

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
   * Send password reset code
   */
  static async sendPasswordResetCode(phoneNumber: string, resetCode: string, recipientName?: string): Promise<SMSResponse> {
    const message = `School Management System: Your password reset code is: ${resetCode}. This code will expire in 15 minutes. If you didn't request this, please ignore this message.${recipientName ? ` - ${recipientName}` : ''}`;
    
    return this.sendSMS(phoneNumber, message);
  }

  /**
   * Send verification code
   */
  static async sendVerificationCode(phoneNumber: string, verificationCode: string, purpose: string): Promise<SMSResponse> {
    const message = `School Management System: Your ${purpose} verification code is: ${verificationCode}. This code will expire in 10 minutes. If you didn't request this, please ignore this message.`;
    
    return this.sendSMS(phoneNumber, message);
  }

  /**
   * Send general notification
   */
  static async sendNotification(phoneNumber: string, notification: string): Promise<SMSResponse> {
    const message = `School Management System: ${notification}`;
    
    return this.sendSMS(phoneNumber, message);
  }

  /**
   * Validate phone number format (Bangladesh)
   */
  static validatePhoneNumber(phoneNumber: string): boolean {
    // Remove any non-digit characters
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    
    // Check if it's a valid Bangladesh number (11 digits starting with 01)
    return cleanNumber.length === 11 && cleanNumber.startsWith('01');
  }

  /**
   * Format phone number to standard format
   */
  static formatPhoneNumber(phoneNumber: string): string {
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    
    if (cleanNumber.length === 11 && cleanNumber.startsWith('01')) {
      return cleanNumber;
    }
    
    throw new Error('Invalid phone number format. Must be 11 digits starting with 01');
  }
}
