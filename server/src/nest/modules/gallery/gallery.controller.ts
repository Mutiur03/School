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
import { Auth } from '../../common/auth.guard.js';
import { CurrentUser } from '../../common/current-user.decorator.js';
import type { AuthUser } from '../../common/current-user.decorator.js';
import { SchoolId } from '../../common/school-id.decorator.js';
import { UploadUrlQueryDto } from '../../common/upload-url.dto.js';
import {
  BulkImageStatusDto,
  CategoryImagesStatusDto,
  CreateCategoryDto,
  CreateGalleryImagesDto,
  ImageIdsDto,
  ImageStatusDto,
  ImageStatusQueryDto,
  ModerationQueryDto,
  ThumbnailDto,
  UpdateGalleryImageDto,
} from './dto/gallery.dto.js';
import { GalleryService, uploadStatusFor } from './gallery.service.js';

/**
 * Gallery: public approved albums, uploads by any signed-in role (admin uploads are published
 * straight away, everyone else's wait for moderation), admin moderation and album thumbnails.
 */
@Controller('gallery')
export class GalleryController {
  constructor(private readonly gallery: GalleryService) {}

  /** Approved images grouped by event and category. */
  @Get()
  findApproved(@SchoolId() schoolId: number) {
    return this.gallery.getGalleries(schoolId);
  }

  @Get('upload-url')
  @UseGuards(Auth('admin', 'teacher', 'student'))
  uploadUrl(@SchoolId() schoolId: number, @Query() query: UploadUrlQueryDto) {
    return this.gallery.getPresignedUploadUrl(query.filename, query.contentType, schoolId);
  }

  @Post('images')
  @UseGuards(Auth('admin', 'teacher', 'student'))
  async upload(
    @SchoolId() schoolId: number,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateGalleryImagesDto,
  ) {
    return this.gallery.addGallery(
      {
        keys: dto.keys,
        caption: dto.caption,
        eventId: dto.eventId,
        category: dto.categoryId,
        // Status is decided here, never by the client.
        status: uploadStatusFor(user.role),
      },
      user.id,
      user.role,
      schoolId,
    );
  }

  /** Moderation queues (admin). */
  @Get('images')
  @UseGuards(Auth('admin'))
  findForModeration(@SchoolId() schoolId: number, @Query() query: ModerationQueryDto) {
    return query.status === 'pending'
      ? this.gallery.getPending(schoolId)
      : this.gallery.getRejected(schoolId);
  }

  /** The signed-in student's own uploads by status. */
  @Get('my-images')
  @UseGuards(Auth('student'))
  findMine(
    @SchoolId() schoolId: number,
    @CurrentUser() user: AuthUser,
    @Query() query: ImageStatusQueryDto,
  ) {
    return this.gallery.getStudentGalleries(user.id, query.status, schoolId);
  }

  /** Bulk reject. */
  @Patch('images')
  @UseGuards(Auth('admin'))
  bulkStatus(@SchoolId() schoolId: number, @Body() dto: BulkImageStatusDto) {
    return this.gallery.setStatusMany(dto.ids, dto.status, schoolId);
  }

  /** Bulk delete (rows + objects in storage). */
  @Delete('images')
  @UseGuards(Auth('admin'))
  async bulkRemove(@SchoolId() schoolId: number, @Body() dto: ImageIdsDto) {
    await this.gallery.deleteMany(dto.ids, schoolId);
  }

  @Patch('images/:id')
  @UseGuards(Auth('admin'))
  update(
    @SchoolId() schoolId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGalleryImageDto,
  ) {
    return this.gallery.updateGallery(
      id,
      {
        imageKey: dto.imageKey,
        caption: dto.caption,
        eventId: dto.eventId,
        category: dto.categoryId,
      },
      schoolId,
    );
  }

  @Patch('images/:id/status')
  @UseGuards(Auth('admin'))
  setStatus(
    @SchoolId() schoolId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ImageStatusDto,
  ) {
    return this.gallery.setStatus(id, dto.status, schoolId);
  }

  @Delete('images/:id')
  @UseGuards(Auth('admin'))
  async remove(@SchoolId() schoolId: number, @Param('id', ParseIntPipe) id: number) {
    await this.gallery.deleteGallery(id, schoolId);
  }

  @Get('categories')
  findCategories(@SchoolId() schoolId: number) {
    return this.gallery.getCategories(schoolId);
  }

  @Post('categories')
  @UseGuards(Auth('admin'))
  createCategory(@SchoolId() schoolId: number, @Body() dto: CreateCategoryDto) {
    return this.gallery.addCategory(dto.category, schoolId);
  }

  @Get('categories/:id/images')
  findByCategory(@SchoolId() schoolId: number, @Param('id', ParseIntPipe) id: number) {
    return this.gallery.getByCategoryId(id, schoolId);
  }

  /** Reject every image in the category. */
  @Patch('categories/:id/images')
  @UseGuards(Auth('admin'))
  rejectCategory(
    @SchoolId() schoolId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() _dto: CategoryImagesStatusDto,
  ) {
    return this.gallery.rejectByCategory(id, schoolId);
  }

  @Put('categories/:id/thumbnail')
  @UseGuards(Auth('admin'))
  setCategoryThumbnail(
    @SchoolId() schoolId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ThumbnailDto,
  ) {
    return this.gallery.setCategoryThumbnail(id, dto.imageId, schoolId);
  }

  @Get('events/:id/images')
  findByEvent(@SchoolId() schoolId: number, @Param('id', ParseIntPipe) id: number) {
    return this.gallery.getByEventId(id, schoolId);
  }

  @Delete('events/:id/images')
  @UseGuards(Auth('admin'))
  async removeByEvent(@SchoolId() schoolId: number, @Param('id', ParseIntPipe) id: number) {
    await this.gallery.deleteByEvent(id, schoolId);
  }

  @Put('events/:id/thumbnail')
  @UseGuards(Auth('admin'))
  setEventThumbnail(
    @SchoolId() schoolId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ThumbnailDto,
  ) {
    return this.gallery.setEventThumbnail(id, dto.imageId, schoolId);
  }
}
