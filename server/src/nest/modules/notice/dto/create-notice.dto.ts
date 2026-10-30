import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateNoticeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  /** R2 key from `GET /notices/upload-url` (must belong to this school). */
  @IsString()
  @IsNotEmpty()
  key!: string;

  /** Publish date `YYYY-MM-DD`; omitted = now. */
  @IsOptional()
  @IsDateString()
  created_at?: string;
}
