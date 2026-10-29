import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Auth } from '../../common/auth.guard.js';
import { DashboardService } from './dashboard.service.js';
import { AttendanceQueryDto } from './dto/attendance-query.dto.js';

/** Admin home screen. */
@Controller('dashboard')
@UseGuards(Auth('admin'))
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /** Announcements, events, exam schedule and headline counts. */
  @Get('overview')
  overview() {
    return this.dashboard.getDashboardData();
  }

  /** Daily present/absent series for the last `days` days. */
  @Get('attendance-summary')
  attendance(@Query() query: AttendanceQueryDto) {
    return this.dashboard.getAttendanceData(query.days ?? 7);
  }
}
