import { Module } from '@nestjs/common';
import { ExamResultFilesController } from './exam-result-files.controller.js';
import { ExamResultFilesService } from './exam-result-files.service.js';

@Module({ providers: [ExamResultFilesService], controllers: [ExamResultFilesController] })
export class ExamResultFilesModule {}
