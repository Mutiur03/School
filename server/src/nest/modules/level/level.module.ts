import { Module } from '@nestjs/common';
import { MarksheetsModule } from '../marksheets/marksheets.module.js';
import { LevelController } from './level.controller.js';
import { LevelService } from './level.service.js';

@Module({
  imports: [MarksheetsModule],
  controllers: [LevelController],
  providers: [LevelService],
})
export class LevelModule {}
