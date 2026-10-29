import { Module } from '@nestjs/common';
import { SyllabusService } from './syllabus.service.js';
import { SyllabusController } from './syllabus.controller.js';

@Module({
  providers: [SyllabusService],
  controllers: [SyllabusController],
})
export class SyllabusModule {}
