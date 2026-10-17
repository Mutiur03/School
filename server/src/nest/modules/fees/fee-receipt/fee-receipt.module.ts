import { Module } from '@nestjs/common';
import { FeeDueService } from './fee-due.service.js';
import { FeeReceiptController } from './fee-receipt.controller.js';
import { FeeReceiptPdfService } from './fee-receipt-pdf.service.js';
import { FeeReceiptService } from './fee-receipt.service.js';

@Module({
  controllers: [FeeReceiptController],
  providers: [FeeReceiptService, FeeReceiptPdfService, FeeDueService],
  exports: [FeeDueService],
})
export class FeeReceiptModule {}
