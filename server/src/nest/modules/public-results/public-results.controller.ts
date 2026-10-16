import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/current-user.decorator.js';
import type { AuthUser } from '../../common/current-user.decorator.js';
import { SchoolId } from '../../common/school-id.decorator.js';
import {
  PublicExamsQueryDto,
  PublicResultQueryDto,
  PublicResultVerifyDto,
} from './dto/public-result.dto.js';
import { MarksheetCacheService } from '../marksheets/cache/marksheet-cache.service.js';
import { pdfFile } from '../../common/pdf-file.js';
import { PublicResultGuard } from './public-result.guard.js';
import { PublicResultsService } from './public-results.service.js';

/** Public site result lookup. No login; the tenant middleware resolves the school from the host. */
@Controller('public-results')
export class PublicResultsController {
  constructor(
    private readonly results: PublicResultsService,
    private readonly marksheets: MarksheetCacheService,
  ) {}

  @Get('exams')
  findAllExams(@SchoolId() schoolId: number, @Query() q: PublicExamsQueryDto) {
    return this.results.listExams(schoolId, q.year, q.class);
  }

  @Post('verification')
  createVerification(@SchoolId() schoolId: number, @Body() dto: PublicResultVerifyDto) {
    return this.results.verify(schoolId, dto);
  }

  @Get()
  @UseGuards(PublicResultGuard)
  findOne(
    @SchoolId() schoolId: number,
    @Query() q: PublicResultQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.results.getExamResult(schoolId, user.id, q.year, q.exam);
  }

  @Get('marksheet')
  @UseGuards(PublicResultGuard)
  async findMarksheet(
    @SchoolId() schoolId: number,
    @Query() q: PublicResultQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.results.assertPublished(schoolId, q.exam);
    const { buffer, studentName } = await this.marksheets.serve(
      schoolId,
      user.id,
      q.year,
      q.exam,
      user,
    );
    return pdfFile(buffer, `marksheet_${studentName}_${q.exam}_${q.year}.pdf`);
  }
}
