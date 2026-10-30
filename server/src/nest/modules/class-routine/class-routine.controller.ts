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
import { R2KeyDto, UploadUrlQueryDto } from '../../common/upload-url.dto.js';
import { ClassRoutineService } from './class-routine.service.js';

/** Class routine PDFs: public list, admin CRUD (tenant scoped by RLS via the request context). */
@Controller('class-routines')
export class ClassRoutineController {
  constructor(private readonly routines: ClassRoutineService) {}

  @Get()
  findAll() {
    return this.routines.listPdfs();
  }

  @Get('upload-url')
  @UseGuards(Auth('admin'))
  uploadUrl(@Query() query: UploadUrlQueryDto) {
    return this.routines.getPresignedUploadUrl(query.filename, query.contentType);
  }

  @Post()
  @UseGuards(Auth('admin'))
  create(@Body() dto: R2KeyDto) {
    return this.routines.createPdf(dto.key);
  }

  /** Replace the PDF (the old object is removed from storage). */
  @Patch(':id')
  @UseGuards(Auth('admin'))
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: R2KeyDto) {
    return this.routines.updatePdf(id, dto.key);
  }

  @Delete(':id')
  @UseGuards(Auth('admin'))
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.routines.deletePdf(id);
  }
}
