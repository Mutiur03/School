import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class CollectionQueryDto {
  @IsDateString()
  @Matches(DAY, { message: 'from must be YYYY-MM-DD' })
  from!: string;

  @IsDateString()
  @Matches(DAY, { message: 'to must be YYYY-MM-DD' })
  to!: string;
}

export class DuesQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  class!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1)
  section?: string;

  /** Monthly fees are due up to and including this month (default: whole year). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  upto_month?: number;
}

export class SummaryQueryDto {
  /** The school's "today": the client sends it so server time zone never shifts the day. */
  @IsDateString()
  @Matches(DAY, { message: 'date must be YYYY-MM-DD' })
  date!: string;
}
