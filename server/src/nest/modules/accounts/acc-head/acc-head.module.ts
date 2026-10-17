import { Module } from '@nestjs/common';
import { AccHeadController } from './acc-head.controller.js';
import { AccHeadService } from './acc-head.service.js';
import { OpeningBalanceService } from './opening-balance.service.js';

@Module({ controllers: [AccHeadController], providers: [AccHeadService, OpeningBalanceService] })
export class AccHeadModule {}
