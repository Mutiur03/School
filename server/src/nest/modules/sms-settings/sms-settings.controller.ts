import { Body, Controller, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SMSService } from '@/utils/sms.service.js';
import { Auth } from '../../common/auth.guard.js';
import { MessageCountQueryDto, TestSmsDto, UpdateSmsSettingsDto } from './dto/sms-settings.dto.js';
import { SmsSettingsService, toTenantSmsSettings } from './sms-settings.service.js';

/**
 * Tenant SMS settings under `/sms`. The service stays static because the Express attendance
 * module shares it. Super-admin credential/balance routes live in nest/modules/school
 * (pre-tenant `/api/platform/schools/:id/sms-*`).
 */
@Controller('sms')
export class SmsSettingsController {
  @Get('settings')
  @UseGuards(Auth('admin'))
  async findSettings() {
    return toTenantSmsSettings(await SmsSettingsService.getSettings());
  }

  @Patch('settings')
  @UseGuards(Auth('admin'))
  async updateSettings(@Body() dto: UpdateSmsSettingsDto) {
    return toTenantSmsSettings(await SmsSettingsService.updateSettings(dto));
  }

  /** Non-secret subset for the attendance screens (teachers too). */
  @Get('settings/public')
  @UseGuards(Auth('admin', 'teacher'))
  async findPublicSettings() {
    const settings = await SmsSettingsService.getSettings();
    const [{ estimatedSms }, schoolName] = await Promise.all([
      SmsSettingsService.getBalance(),
      SmsSettingsService.getSchoolName(),
    ]);
    return {
      is_active: settings.is_active,
      send_to_present: settings.send_to_present,
      send_to_absent: settings.send_to_absent,
      send_to_run_awayed: settings.send_to_run_awayed,
      present_template: settings.present_template,
      absent_template: settings.absent_template,
      run_awayed_template: settings.run_awayed_template,
      sms_balance: estimatedSms,
      school_name: schoolName,
    };
  }

  @Get('balance')
  @UseGuards(Auth('admin'))
  findBalance() {
    return SmsSettingsService.getBalance();
  }

  @Post('test-messages')
  @UseGuards(Auth('admin'))
  sendTest(@Body() dto: TestSmsDto) {
    return SmsSettingsService.sendTestSms(dto.phoneNumber, dto.message);
  }

  /** Segments/encoding a text would use: `?text=`. */
  @Get('message-count')
  @UseGuards(Auth('admin'))
  messageCount(@Query() query: MessageCountQueryDto) {
    return SMSService.calculateSMSCount(query.text);
  }
}
