import { Module } from '@nestjs/common';
import { SmsSettingsController } from './sms-settings.controller.js';

@Module({ controllers: [SmsSettingsController] })
export class SmsSettingsModule {}
