import { Module } from '@nestjs/common';
import { FeeStructureController } from './fee-structure.controller.js';
import { FeeStructureService } from './fee-structure.service.js';

@Module({ controllers: [FeeStructureController], providers: [FeeStructureService] })
export class FeeStructureModule {}
