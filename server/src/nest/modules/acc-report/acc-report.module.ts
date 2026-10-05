import { Module } from '@nestjs/common';
import { AccReportController } from './acc-report.controller.js';
import { AccReportService } from './acc-report.service.js';

@Module({ controllers: [AccReportController], providers: [AccReportService] })
export class AccReportModule {}
