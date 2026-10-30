import { Module } from '@nestjs/common';
import { CitizenCharterService } from './citizen-charter.service.js';
import { CitizenCharterController } from './citizen-charter.controller.js';

@Module({
  providers: [CitizenCharterService],
  controllers: [CitizenCharterController],
})
export class CitizenCharterModule {}
