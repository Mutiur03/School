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
import { CreateNoticeDto } from './dto/create-notice.dto.js';
import { NoticeQueryDto } from './dto/notice-query.dto.js';
import { UpdateNoticeDto } from './dto/update-notice.dto.js';
import { NoticeService } from './notice.service.js';

/** Notices: public list, admin CRUD. The PDF goes straight to R2 via `upload-url`. */
@Controller('notices')
export class NoticeController {
  constructor(private readonly notices: NoticeService) {}

  @Get()
  findAll(@SchoolId() schoolId: number, @Query() query: NoticeQueryDto) {
    return this.notices.getNotices(query.limit, schoolId);
  }

  @Get('upload-url')
  @UseGuards(Auth('admin'))
  uploadUrl(@Query() query: UploadUrlQueryDto) {
    return this.notices.getPresignedUploadUrl(query.filename, query.contentType);
  }

  @Post()
  @UseGuards(Auth('admin'))
  create(@SchoolId() schoolId: number, @Body() dto: CreateNoticeDto) {
    return this.notices.createNotice(dto, schoolId);
  }

  @Patch(':id')
  @UseGuards(Auth('admin'))
  update(
    @SchoolId() schoolId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNoticeDto,
  ) {
    return this.notices.updateNotice(id, dto, schoolId);
  }

  @Delete(':id')
  @UseGuards(Auth('admin'))
  async remove(@SchoolId() schoolId: number, @Param('id', ParseIntPipe) id: number) {
    await this.notices.deleteNotice(id, schoolId);
  }
}
