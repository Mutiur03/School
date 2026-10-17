import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateFeeWaiverDto {
  @IsInt()
  student_id!: number;

  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  /** Omit to waive every waivable head. */
  @IsOptional()
  @IsInt()
  fee_head_id?: number;

  /** true → `value` is a percentage of each charge, false → a fixed amount per installment. */
  @IsOptional()
  @IsBoolean()
  percent?: boolean;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9_999_999_999.99)
  value!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class WaiverQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  student_id?: number;
}
