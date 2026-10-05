import { Module } from '@nestjs/common';
import { CostCenterController } from './cost-center.controller.js';
import { CostCenterService } from './cost-center.service.js';

@Module({ controllers: [CostCenterController], providers: [CostCenterService] })
export class CostCenterModule {}
