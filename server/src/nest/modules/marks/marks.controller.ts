import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Auth } from '../../common/auth.guard.js';
import { CurrentUser } from '../../common/current-user.decorator.js';
import type { AuthUser } from '../../common/current-user.decorator.js';
import { ExamQueryDto, YearQueryDto } from '../../common/query.dto.js';
import { SchoolId } from '../../common/school-id.decorator.js';
import { BulkUpdateFourthSubjectDto, UpdateFourthSubjectDto } from './dto/fourth-subject.dto.js';
import { ClassMarksQueryDto, RosterQueryDto } from './dto/marks-query.dto.js';
import { SaveMarksDto } from './dto/save-marks.dto.js';
import { MarksService } from './marks.service.js';

@Controller('marks')
export class MarksController {
  constructor(private readonly marks: MarksService) {}

  @Put()
  @UseGuards(Auth('admin', 'teacher'))
  update(@SchoolId() schoolId: number, @Body() dto: SaveMarksDto, @CurrentUser() user: AuthUser) {
    return this.marks.saveMarks(schoolId, dto, user);
  }

  @Get()
  @UseGuards(Auth('admin', 'teacher'))
  findAll(
    @SchoolId() schoolId: number,
    @Query() q: ClassMarksQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.marks.getClassMarks(schoolId, q.class, q.year, q.exam, user);
  }

  @Get('roster')
  @UseGuards(Auth('admin', 'teacher'))
  findRoster(
    @SchoolId() schoolId: number,
    @Query() q: RosterQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.marks.getRoster(schoolId, q.class, q.year, q.section, user);
  }

  @Get('students/:studentId')
  @UseGuards(Auth('admin', 'teacher', 'student'))
  findOne(
    @SchoolId() schoolId: number,
    @Param('studentId', ParseIntPipe) studentId: number,
    @Query() q: ExamQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.marks.getStudentMarks(schoolId, studentId, q.year, q.exam, user);
  }

  @Get('students/:studentId/session')
  @UseGuards(Auth('admin', 'teacher', 'student'))
  findSession(
    @SchoolId() schoolId: number,
    @Param('studentId', ParseIntPipe) studentId: number,
    @Query() q: YearQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.marks.getSessionPreview(schoolId, studentId, q.year, user);
  }

  @Patch('students/:studentId/fourth-subject')
  @UseGuards(Auth('admin', 'teacher'))
  updateFourthSubject(
    @SchoolId() schoolId: number,
    @Param('studentId', ParseIntPipe) studentId: number,
    @Body() dto: UpdateFourthSubjectDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.marks.updateFourthSubject(
      schoolId,
      studentId,
      dto.year,
      dto.subjectId ?? null,
      user,
    );
  }

  @Patch('fourth-subjects')
  @UseGuards(Auth('admin'))
  updateFourthSubjects(@SchoolId() schoolId: number, @Body() dto: BulkUpdateFourthSubjectDto) {
    return this.marks.bulkUpdateFourthSubject(schoolId, dto);
  }
}
