import { prisma } from "@/config/prisma.js";
import { SMSService } from "@/utils/sms.service.js";
import { ApiError } from "@/utils/ApiError.js";

export class SmsSettingsService {
  static async getSettings() {
    let settings = await prisma.sms_settings.findFirst();
    if (!settings) {
      settings = await prisma.sms_settings.create({
        data: {},
      });
    }
    return settings;
  }

  static async updateSettings(data: any) {
    const settings = await this.getSettings();
    
    // Validate templates if they are being updated
    if (data.present_template) {
      this.validateTemplate(data.present_template, "Present Notification");
    }
    if (data.absent_template) {
      this.validateTemplate(data.absent_template, "Absent Notification");
    }

    // Filter out restricted fields for regular admin updates
    const { api_key, api_url, sender_id, service_type, sms_balance, ...safeData } = data;
    
    return await prisma.sms_settings.update({
      where: { id: settings.id },
      data: safeData,
    });
  }

  private static validateTemplate(template: string, name: string) {
    const required = ["{student_name}", "{login_id}", "{date}", "{school_name}"];
    const missing = required.filter(p => !template.includes(p));
    
    if (missing.length > 0) {
      throw new ApiError(400, `${name} template is missing mandatory placeholders: ${missing.join(", ")}`);
    }
  }

  static async updateBalance(amount: number) {
    const settings = await this.getSettings();
    return await prisma.sms_settings.update({
      where: { id: settings.id },
      data: {
        sms_balance: {
          increment: amount
        }
      }
    });
  }

  static async getBalance() {
    const settings = await this.getSettings();
    return {
      balance: settings.sms_balance,
    };
  }

  static async sendTestSMS(phoneNumber: string, message: string) {
    return await SMSService.sendTestSMS(phoneNumber, message);
  }

  static calculateSMSCount(text: string) {
    return SMSService.calculateSMSCount(text);
  }
}
