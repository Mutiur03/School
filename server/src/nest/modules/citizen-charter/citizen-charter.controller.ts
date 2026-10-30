import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { Auth } from '../../common/auth.guard.js';
import { SchoolId } from '../../common/school-id.decorator.js';
import { R2KeyDto, UploadUrlQueryDto } from '../../common/upload-url.dto.js';
import { CitizenCharterService } from './citizen-charter.service.js';

/** The school's single citizen-charter PDF (a singleton resource: `document`). */
@Controller('citizen-charter')
export class CitizenCharterController {
  constructor(private readonly charter: CitizenCharterService) {}

  /** 404 until one has been uploaded. */
  @Get('document')
  findOne(@SchoolId() schoolId: number) {
    return this.charter.getCharter(schoolId);
  }

  @Get('upload-url')
  @UseGuards(Auth('admin'))
  uploadUrl(@Query() query: UploadUrlQueryDto) {
    return this.charter.getPresignedUploadUrl(query.filename, query.contentType);
  }

  /** Create or replace (the old PDF is removed from storage). */
  @Put('document')
  @UseGuards(Auth('admin'))
  upsert(@SchoolId() schoolId: number, @Body() dto: R2KeyDto) {
    return this.charter.upsertCharter(dto.key, schoolId);
  }
}
