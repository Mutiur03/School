import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

/** Empty query values (`?date=`) mean "not set". */
const emptyToUndefined = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

export class SmsLogsQueryDto {
  /** One status, a comma list, or `all`. */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  status?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  date?: string;

  /** One category, a comma list, or `all` (default `attendance`). */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class SmsLogIdsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids!: number[];
}

/** Retry selected `ids`, or every failed log matching `category`/`date` when `allFailed` is true. */
export class RetrySmsDto {
  @IsOptional()
  @IsBoolean()
  allFailed?: boolean;

  @ValidateIf((o: RetrySmsDto) => !o.allFailed)
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids?: number[];

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  category?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  date?: string;
}

export class UsageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;
}

export class BulkSmsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Please select at least one class.' })
  @IsInt({ each: true })
  classNames!: number[];

  @IsString()
  @IsNotEmpty({ message: 'Message content cannot be empty.' })
  @MaxLength(1000)
  message!: string;
}

/** `?classes=6,7,8` */
export class RecipientCountQueryDto {
  @IsOptional()
  @Transform(({ value }) =>
    String(value ?? '')
      .split(',')
      .filter((x) => x.trim() !== '')
      .map(Number),
  )
  @IsInt({ each: true, message: 'classes must be a comma-separated list of class numbers' })
  classes: number[] = [];
}
