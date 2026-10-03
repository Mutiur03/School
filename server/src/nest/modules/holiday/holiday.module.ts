import { Module } from '@nestjs/common';
import { HolidayController } from './holiday.controller.js';
import { HolidayService } from './holiday.service.js';

@Module({ controllers: [HolidayController], providers: [HolidayService] })
export class HolidayModule {}
