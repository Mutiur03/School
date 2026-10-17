import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { VoucherType } from '@/generated/prisma/client.js';

// Decimal(12,2) ceiling; larger values would fail in Postgres with a 500.
const MAX_AMOUNT = 9_999_999_999.99;

export class VoucherLineDto {
  @IsInt()
  head_id!: number;

  @IsOptional()
  @IsInt()
  cost_center_id?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_AMOUNT)
  debit?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_AMOUNT)
  credit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class CreateVoucherDto {
  @IsEnum(VoucherType)
  type!: VoucherType;

  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  @IsOptional()
  @IsString()
  narration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => VoucherLineDto)
  lines!: VoucherLineDto[];
}
