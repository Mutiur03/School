import { Module } from '@nestjs/common';
import { MarksheetsModule } from '../marksheets/marksheets.module.js';
import { PublicResultsController } from './public-results.controller.js';
import { PublicResultsService } from './public-results.service.js';

@Module({
  imports: [MarksheetsModule],
  controllers: [PublicResultsController],
  providers: [PublicResultsService],
})
export class PublicResultsModule {}
