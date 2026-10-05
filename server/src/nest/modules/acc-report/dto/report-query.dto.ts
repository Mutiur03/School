import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional } from 'class-validator';

export class ReportQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class LedgerQueryDto extends ReportQueryDto {
  @Type(() => Number)
  @IsInt()
  head_id!: number;
}
