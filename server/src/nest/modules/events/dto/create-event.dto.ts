import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  details?: string;

  @IsOptional()
  @IsString()
  location?: string;

  /** R2 keys from `GET /events/upload-url?type=image|file`. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  imageKey?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  fileKey?: string;
}
