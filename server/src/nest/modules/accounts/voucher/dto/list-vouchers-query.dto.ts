import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional } from 'class-validator';
import { VoucherType } from '@/generated/prisma/client.js';

export class ListVouchersQueryDto {
  @IsOptional()
  @IsEnum(VoucherType)
  type?: VoucherType;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  head_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  cost_center_id?: number;
}
