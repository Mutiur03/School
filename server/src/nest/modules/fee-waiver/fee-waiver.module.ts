import { Module } from '@nestjs/common';
import { FeeWaiverController } from './fee-waiver.controller.js';
import { FeeWaiverService } from './fee-waiver.service.js';

@Module({ controllers: [FeeWaiverController], providers: [FeeWaiverService] })
export class FeeWaiverModule {}
