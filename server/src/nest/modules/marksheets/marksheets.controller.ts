import { Controller, Get, Header, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { Auth } from '../../common/auth.guard.js';
import { CurrentUser } from '../../common/current-user.decorator.js';
import type { AuthUser } from '../../common/current-user.decorator.js';
import { pdfFile } from '../../common/pdf-file.js';
import { ExamQueryDto, YearQueryDto } from '../../common/query.dto.js';
import { SchoolId } from '../../common/school-id.decorator.js';
import { MarksheetCacheService } from './cache/marksheet-cache.service.js';
import { SectionExamQueryDto } from './dto/marksheet-query.dto.js';
import { MarksheetJobsService } from './jobs/marksheet-jobs.service.js';
import { ClassSummaryService } from './pdf/class-summary.service.js';

/** Marksheet PDFs (served from the worker's R2 cache) and generation status. */
@Controller('marksheets')
export class MarksheetsController {
  constructor(
    private readonly cache: MarksheetCacheService,
    private readonly jobs: MarksheetJobsService,
    private readonly summary: ClassSummaryService,
  ) {}

  /** Per-exam marksheet (a year-end exam renders the session design). */
  @Get('students/:studentId')
  @UseGuards(Auth('admin', 'teacher', 'student'))
  async findOne(
    @SchoolId() schoolId: number,
    @Param('studentId', ParseIntPipe) studentId: number,
    @Query() q: ExamQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const { buffer, studentName } = await this.cache.serve(
      schoolId,
      studentId,
      q.year,
      q.exam,
      user,
    );
    return pdfFile(buffer, `marksheet_${studentName}_${q.exam}_${q.year}.pdf`);
  }

  @Get('students/:studentId/session')
  @UseGuards(Auth('admin', 'teacher', 'student'))
  async findSession(
    @SchoolId() schoolId: number,
    @Param('studentId', ParseIntPipe) studentId: number,
    @Query() q: YearQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const { buffer } = await this.cache.serveSessionStudent(schoolId, studentId, q.year, user);
    return pdfFile(buffer, `session_marksheet_${studentId}_${q.year}.pdf`);
  }

  @Get('session')
  @UseGuards(Auth('admin'))
  async findAllSession(
    @SchoolId() schoolId: number,
    @Query() q: YearQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const { buffer } = await this.cache.serveSessionYear(schoolId, q.year, user);
    return pdfFile(buffer, `all_marksheets_${q.year}.pdf`);
  }

  /** Whole-class (or section) bundle: JSON `{ url }` of the cached PDF. */
  @Get('classes/:class/bundle')
  @UseGuards(Auth('admin', 'teacher'))
  findBundle(
    @SchoolId() schoolId: number,
    @Param('class', ParseIntPipe) cls: number,
    @Query() q: SectionExamQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.cache.serveBundle(schoolId, q.year, cls, q.exam, user, q.section);
  }

  @Get('classes/:class/summary')
  @UseGuards(Auth('admin', 'teacher'))
  async findSummary(
    @SchoolId() schoolId: number,
    @Param('class', ParseIntPipe) cls: number,
    @Query() q: SectionExamQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const { buffer, filename } = await this.summary.generateClassSummaryPDF(
      schoolId,
      cls,
      q.year,
      q.exam,
      user,
      q.section,
    );
    return pdfFile(buffer, filename, 'attachment');
  }

  /** Progress must not be cached (CDN/browser 304s freeze the UI mid-queue). */
  @Get('exams/:examId/status')
  @UseGuards(Auth('admin', 'teacher'))
  @Header('Cache-Control', 'no-store')
  async findStatus(@SchoolId() schoolId: number, @Param('examId', ParseIntPipe) examId: number) {
    await this.jobs.ensureQueuedForExamIfDue(schoolId, examId);
    return this.jobs.statusCounts(schoolId, examId);
  }
}
