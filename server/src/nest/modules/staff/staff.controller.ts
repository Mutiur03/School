import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { StaffFormData } from '@school/shared-schemas';
import { toPublicStaffProfile } from '@/utils/publicPersonnelDto.util.js';
import { Auth, OptionalAuth } from '../../common/auth.guard.js';
import { CurrentUser } from '../../common/current-user.decorator.js';
import type { AuthUser } from '../../common/current-user.decorator.js';
import { R2KeyDto, UploadUrlQueryDto } from '../../common/upload-url.dto.js';
import { CreateStaffDto } from './dto/create-staff.dto.js';
import { StaffQueryDto } from './dto/staff-query.dto.js';
import { UpdateStaffDto } from './dto/update-staff.dto.js';
import { StaffService } from './staff.service.js';

const toPublic = (row: unknown) => toPublicStaffProfile(row as Record<string, unknown>);

/** Staff directory. Public list (admins see full rows), admin CRUD + photo. */
@Controller('staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  @UseGuards(OptionalAuth())
  async findAll(@Query() query: StaffQueryDto, @CurrentUser() user?: AuthUser) {
    const isAdmin = user?.role === 'admin';
    if (query.page !== undefined || query.limit !== undefined || query.search?.trim()) {
      const result = await this.staff.getStaffsPaginated({
        page: query.page ?? NaN,
        limit: query.limit ?? NaN,
        search: query.search,
      });
      return isAdmin ? result : { ...result, data: result.data.map(toPublic) };
    }
    const rows = await this.staff.getStaffs();
    return isAdmin ? rows : rows.map(toPublic);
  }

  @Post()
  @UseGuards(Auth('admin'))
  create(@Body() dto: CreateStaffDto) {
    return this.staff.addStaff(dto.staff as StaffFormData[]);
  }

  @Patch(':id')
  @UseGuards(Auth('admin'))
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStaffDto) {
    return this.staff.updateStaff(id, dto as StaffFormData);
  }

  @Delete(':id')
  @UseGuards(Auth('admin'))
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.staff.deleteStaff(id);
  }

  @Get(':id/image/upload-url')
  @UseGuards(Auth('admin'))
  imageUploadUrl(@Param('id', ParseIntPipe) id: number, @Query() query: UploadUrlQueryDto) {
    return this.staff.getPresignedUploadUrl(id, query.filename, query.contentType);
  }

  @Put(':id/image')
  @UseGuards(Auth('admin'))
  saveImage(@Param('id', ParseIntPipe) id: number, @Body() dto: R2KeyDto) {
    return this.staff.saveStaffImage(id, dto.key);
  }

  @Delete(':id/image')
  @UseGuards(Auth('admin'))
  removeImage(@Param('id', ParseIntPipe) id: number) {
    return this.staff.saveStaffImage(id, null);
  }
}
