import { Module } from '@nestjs/common';
import { FeeHeadModule } from './fee-head/fee-head.module.js';
import { FeeStructureModule } from './fee-structure/fee-structure.module.js';
import { FeeWaiverModule } from './fee-waiver/fee-waiver.module.js';
import { FeeReceiptModule } from './fee-receipt/fee-receipt.module.js';
import { FeeReportModule } from './fee-report/fee-report.module.js';

@Module({
  imports: [FeeHeadModule, FeeStructureModule, FeeWaiverModule, FeeReceiptModule, FeeReportModule],
})
export class FeesModule {}
