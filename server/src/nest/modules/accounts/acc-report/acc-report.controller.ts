import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Auth } from '../../../common/auth.guard.js';
import { SchoolId } from '../../../common/school-id.decorator.js';
import { AccReportService } from './acc-report.service.js';
import { LedgerQueryDto, ReportQueryDto } from './dto/report-query.dto.js';

@Controller('acc-reports')
@UseGuards(Auth('admin'))
export class AccReportController {
  constructor(private readonly reports: AccReportService) {}

  @Get('ledger')
  findLedger(@SchoolId() schoolId: number, @Query() q: LedgerQueryDto) {
    return this.reports.ledger(schoolId, q);
  }

  @Get('trial-balance')
  findTrialBalance(@SchoolId() schoolId: number, @Query() q: ReportQueryDto) {
    return this.reports.trialBalance(schoolId, q);
  }

  @Get('income-expense')
  findIncomeExpense(@SchoolId() schoolId: number, @Query() q: ReportQueryDto) {
    return this.reports.incomeExpense(schoolId, q);
  }

  @Get('balance-sheet')
  findBalanceSheet(@SchoolId() schoolId: number, @Query() q: ReportQueryDto) {
    return this.reports.balanceSheet(schoolId, q);
  }

  @Get('cost-center')
  findCostCenter(@SchoolId() schoolId: number, @Query() q: ReportQueryDto) {
    return this.reports.costCenter(schoolId, q);
  }
}
