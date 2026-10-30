import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Auth } from '../../common/auth.guard.js';
import { SchoolId } from '../../common/school-id.decorator.js';
import { UploadUrlQueryDto } from '../../common/upload-url.dto.js';
import { CreateSyllabusDto } from './dto/create-syllabus.dto.js';
import { SyllabusQueryDto } from './dto/syllabus-query.dto.js';
import { UpdateSyllabusDto } from './dto/update-syllabus.dto.js';
import { SyllabusService } from './syllabus.service.js';

/** Syllabus PDFs per class/year: public list, admin CRUD. */
@Controller('syllabuses')
export class SyllabusController {
  constructor(private readonly syllabuses: SyllabusService) {}

  @Get()
  findAll(@SchoolId() schoolId: number, @Query() query: SyllabusQueryDto) {
    return this.syllabuses.listSyllabus(
      { class: query.class?.toString(), year: query.year?.toString() },
      schoolId,
    );
  }

  @Get('upload-url')
  @UseGuards(Auth('admin'))
  uploadUrl(@Query() query: UploadUrlQueryDto) {
    return this.syllabuses.getPresignedUploadUrl(query.filename, query.contentType);
  }

  @Post()
  @UseGuards(Auth('admin'))
  create(@SchoolId() schoolId: number, @Body() dto: CreateSyllabusDto) {
    return this.syllabuses.createSyllabus(dto, schoolId);
  }

  @Patch(':id')
  @UseGuards(Auth('admin'))
  update(
    @SchoolId() schoolId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSyllabusDto,
  ) {
    return this.syllabuses.updateSyllabus(id, dto, schoolId);
  }

  @Delete(':id')
  @UseGuards(Auth('admin'))
  async remove(@SchoolId() schoolId: number, @Param('id', ParseIntPipe) id: number) {
    await this.syllabuses.deleteSyllabus(id, schoolId);
  }
}
