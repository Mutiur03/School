import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service.js';
import { DashboardController } from './dashboard.controller.js';

@Module({
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
