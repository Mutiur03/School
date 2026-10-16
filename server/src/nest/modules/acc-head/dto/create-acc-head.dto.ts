import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AccHeadType } from '@/generated/prisma/client.js';

export class CreateAccHeadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @IsEnum(AccHeadType)
  type!: AccHeadType;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @IsOptional()
  @IsInt()
  parent_id?: number;

  @IsOptional()
  @IsBoolean()
  is_cash_bank?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  bank_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  account_no?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
