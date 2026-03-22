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
    
    // Extract requiredPlaceholders from data if present
    const { requiredPlaceholders, ...updateData } = data;

    // Validate templates if they are being updated
    if (updateData.present_template) {
      this.validateTemplate(updateData.present_template, "Present Notification", requiredPlaceholders);
    }
    if (updateData.absent_template) {
      this.validateTemplate(updateData.absent_template, "Absent Notification", requiredPlaceholders);
    }

    // Filter out restricted fields for regular admin updates
    const { api_key, api_url, sender_id, service_type, sms_balance, ...safeData } = updateData;
    
    return await prisma.sms_settings.update({
      where: { id: settings.id },
      data: safeData,
    });
  }

  private static validateTemplate(template: string, name: string, requiredPlaceholders?: string[]) {
    // Always require {student_name}
    const coreRequired = ["{student_name}"];
    const electiveRequired = requiredPlaceholders || [];
    
    // Combine and deduplicate
    const allRequired = Array.from(new Set([...coreRequired, ...electiveRequired]));
    
    // Check for missing mandatory tokens
    const missing = allRequired.filter(p => !template.includes(p));
    if (missing.length > 0) {
      throw new ApiError(400, `${name} template is missing mandatory placeholders: ${missing.join(", ")}`);
    }

    // Check for forbidden tokens (those NOT in the required list)
    const allPossibleElectives = ["{login_id}", "{date}", "{school_name}", "{class}", "{section}", "{roll}"];
    const forbidden = allPossibleElectives.filter(p => !allRequired.includes(p) && template.includes(p));
    
    if (forbidden.length > 0) {
      throw new ApiError(400, `${name} template contains forbidden placeholders (they are unchecked in settings): ${forbidden.join(", ")}`);
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
