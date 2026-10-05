import { Module } from '@nestjs/common';
import { AccHeadController } from './acc-head.controller.js';
import { AccHeadService } from './acc-head.service.js';

@Module({ controllers: [AccHeadController], providers: [AccHeadService] })
export class AccHeadModule {}
