import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma.module.js';
import { AccHeadModule } from './modules/acc-head/acc-head.module.js';
import { AccReportModule } from './modules/acc-report/acc-report.module.js';
import { CostCenterModule } from './modules/cost-center/cost-center.module.js';
import { HolidayModule } from './modules/holiday/holiday.module.js';
import { VoucherModule } from './modules/voucher/voucher.module.js';

/** Migrated + new modules. Legacy Express routers live in src/app.ts until moved here. */
@Module({
  imports: [
    PrismaModule,
    HolidayModule,
    AccHeadModule,
    CostCenterModule,
    VoucherModule,
    AccReportModule,
  ],
})
export class AppModule {}
