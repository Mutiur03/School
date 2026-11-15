import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { examResultFileSchema } from '@school/shared-schemas';
import type { ExamResultFileData } from '@school/shared-schemas';
import { Auth } from '../../common/auth.guard.js';
import { SchoolId } from '../../common/school-id.decorator.js';
import { UploadUrlQueryDto } from '../../common/upload-url.dto.js';
import { ZodBodyPipe } from '../../common/zod-body.pipe.js';
import { ExamResultFilesQueryDto } from './dto/exam-result-files-query.dto.js';
import { ExamResultFilesService } from './exam-result-files.service.js';

/** Admin: upload/replace/remove the result PDF of an exam + class. PDF goes straight to R2 via `upload-url`. */
@Controller('exam-result-files')
@UseGuards(Auth('admin'))
export class ExamResultFilesController {
  constructor(private readonly files: ExamResultFilesService) {}

  @Get('upload-url')
  uploadUrl(@SchoolId() schoolId: number, @Query() q: UploadUrlQueryDto) {
    return this.files.getPresignedUploadUrl(schoolId, q.filename, q.contentType);
  }

  @Get()
  findAll(@SchoolId() schoolId: number, @Query() q: ExamResultFilesQueryDto) {
    return this.files.findAll(schoolId, q.examId);
  }

  @Put(':examId/:class')
  upsert(
    @SchoolId() schoolId: number,
    @Param('examId', ParseIntPipe) examId: number,
    @Param('class', ParseIntPipe) cls: number,
    @Body(new ZodBodyPipe(examResultFileSchema)) dto: ExamResultFileData,
  ) {
    return this.files.upsert(schoolId, examId, cls, dto);
  }

  @Delete(':examId/:class')
  async remove(
    @SchoolId() schoolId: number,
    @Param('examId', ParseIntPipe) examId: number,
    @Param('class', ParseIntPipe) cls: number,
  ) {
    await this.files.remove(schoolId, examId, cls);
  }
}
