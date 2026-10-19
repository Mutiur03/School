import { Module } from '@nestjs/common';
import { SchoolCodeLookupsController, SchoolCodesController } from './school-codes.controller.js';
import { SchoolCodeLookupService, SchoolCodesService } from './school-codes.service.js';

@Module({
  controllers: [SchoolCodesController, SchoolCodeLookupsController],
  providers: [SchoolCodesService, SchoolCodeLookupService],
})
export class SchoolCodesModule {}
