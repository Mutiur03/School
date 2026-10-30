import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export const IMAGE_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ImageStatus = (typeof IMAGE_STATUSES)[number];

/** `POST /gallery/images`: keys from `GET /gallery/upload-url`, for an event or a category. */
export class CreateGalleryImagesDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'No image keys provided' })
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  keys!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  eventId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;
}

export class UpdateGalleryImageDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  imageKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  eventId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;
}

/** Admin moderation: approve or reject. */
export class ImageStatusDto {
  @IsIn(['approved', 'rejected'], { message: 'status must be approved or rejected' })
  status!: 'approved' | 'rejected';
}

/** Bulk moderation / delete by id list. */
export class ImageIdsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids!: number[];
}

export class BulkImageStatusDto extends ImageIdsDto {
  @IsIn(['rejected'], { message: 'status must be rejected' })
  status!: 'rejected';
}

/** Rejecting every image of a category (legacy `deleteCategoryGallery`). */
export class CategoryImagesStatusDto {
  @IsIn(['rejected'], { message: 'status must be rejected' })
  status!: 'rejected';
}

export class ImageStatusQueryDto {
  @IsIn(IMAGE_STATUSES, { message: 'status must be pending, approved or rejected' })
  status!: ImageStatus;
}

export class ModerationQueryDto {
  @IsIn(['pending', 'rejected'], { message: 'status must be pending or rejected' })
  status!: 'pending' | 'rejected';
}

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty({ message: 'category is required' })
  @MaxLength(100)
  category!: string;
}

export class ThumbnailDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  imageId!: number;
}
