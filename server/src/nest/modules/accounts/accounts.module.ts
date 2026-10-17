import { Module } from '@nestjs/common';
import { AccHeadModule } from './acc-head/acc-head.module.js';
import { AccYearModule } from './acc-year/acc-year.module.js';
import { AccReportModule } from './acc-report/acc-report.module.js';
import { CostCenterModule } from './cost-center/cost-center.module.js';
import { VoucherModule } from './voucher/voucher.module.js';

@Module({
  imports: [AccHeadModule, AccYearModule, AccReportModule, CostCenterModule, VoucherModule],
})
export class AccountsModule {}
