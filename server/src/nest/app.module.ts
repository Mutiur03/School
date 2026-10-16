import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma.module.js';
import { AccHeadModule } from './modules/acc-head/acc-head.module.js';
import { AccReportModule } from './modules/acc-report/acc-report.module.js';
import { CostCenterModule } from './modules/cost-center/cost-center.module.js';
import { HolidayModule } from './modules/holiday/holiday.module.js';
import { VoucherModule } from './modules/voucher/voucher.module.js';
import { CertificateModule } from './modules/certificate/certificate.module.js';
import { HolidayModule } from './modules/holiday/holiday.module.js';
import { MarksModule } from './modules/marks/marks.module.js';
import { MarksheetsModule } from './modules/marksheets/marksheets.module.js';
import { PromotionModule } from './modules/promotion/promotion.module.js';
import { PublicResultsModule } from './modules/public-results/public-results.module.js';

/** Migrated + new modules. Legacy Express routers live in src/app.ts until moved here. */
@Module({
  imports: [
    PrismaModule,
    HolidayModule,
    AccHeadModule,
    CostCenterModule,
    VoucherModule,
    AccReportModule,
    MarksModule,
    MarksheetsModule,
    PublicResultsModule,
    PromotionModule,
    CertificateModule,
  ],
})
export class AppModule {}
