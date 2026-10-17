import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
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

  /** Opening balance on the head's natural side (negative = opposite side); 0 clears it. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  opening_balance?: number;

  /** Date of the school's opening balances (YYYY-MM-DD); moves the whole opening voucher. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'opening_date must be YYYY-MM-DD' })
  opening_date?: string;
}
