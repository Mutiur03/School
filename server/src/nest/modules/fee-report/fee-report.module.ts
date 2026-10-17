import { Module } from '@nestjs/common';
import { FeeReportController } from './fee-report.controller.js';
import { FeeReportService } from './fee-report.service.js';

@Module({ controllers: [FeeReportController], providers: [FeeReportService] })
export class FeeReportModule {}
