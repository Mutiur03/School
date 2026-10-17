import { Module } from '@nestjs/common';
import { FeeHeadController } from './fee-head.controller.js';
import { FeeHeadService } from './fee-head.service.js';

@Module({ controllers: [FeeHeadController], providers: [FeeHeadService] })
export class FeeHeadModule {}
