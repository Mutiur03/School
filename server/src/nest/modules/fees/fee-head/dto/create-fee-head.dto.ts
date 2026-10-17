import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { FeeFrequency } from '@/generated/prisma/client.js';

export class CreateFeeHeadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsEnum(FeeFrequency)
  frequency?: FeeFrequency;

  /** Income account that collected fees are credited to. Omit = create "<name> Fees". */
  @IsOptional()
  @IsInt()
  income_head_id?: number;

  /** Cash/bank account this fee is always deposited into. Omit/null = choose at collection. */
  @IsOptional()
  @IsInt()
  deposit_head_id?: number | null;

  @IsOptional()
  @IsBoolean()
  is_waivable?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
