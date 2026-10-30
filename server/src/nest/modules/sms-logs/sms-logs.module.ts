import { Module } from '@nestjs/common';
import { SmsLogsController } from './sms-logs.controller.js';

@Module({ controllers: [SmsLogsController] })
export class SmsLogsModule {}
