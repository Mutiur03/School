import { Module } from '@nestjs/common';
import { MarksheetsModule } from '../marksheets/marksheets.module.js';
import { MarksController } from './marks.controller.js';
import { MarksService } from './marks.service.js';

@Module({
  imports: [MarksheetsModule],
  controllers: [MarksController],
  providers: [MarksService],
})
export class MarksModule {}
