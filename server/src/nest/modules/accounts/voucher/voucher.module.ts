import { Module } from '@nestjs/common';
import { VoucherController } from './voucher.controller.js';
import { VoucherService } from './voucher.service.js';

@Module({ controllers: [VoucherController], providers: [VoucherService] })
export class VoucherModule {}
