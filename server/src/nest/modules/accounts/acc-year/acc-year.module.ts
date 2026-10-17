import { Module } from '@nestjs/common';
import { AccYearController } from './acc-year.controller.js';
import { AccYearService } from './acc-year.service.js';

@Module({ controllers: [AccYearController], providers: [AccYearService] })
export class AccYearModule {}
