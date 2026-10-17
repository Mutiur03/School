import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReceiptItemDto {
  @IsInt()
  fee_head_id!: number;

  /** 1-12 for monthly heads, 0 for one-off heads. */
  @IsInt()
  @Min(0)
  @Max(12)
  month!: number;
}

export class CreateFeeReceiptDto {
  @IsInt()
  student_id!: number;

  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  /**
   * Cash or bank head for fees that have no fixed deposit account. Optional when every picked
   * fee head already names its own deposit account.
   */
  @IsOptional()
  @IsInt()
  pay_head_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ReceiptItemDto)
  items!: ReceiptItemDto[];
}

export class ListReceiptsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  class?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1)
  section?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  student_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  receipt_no?: number;
}

export class StatementQueryDto {
  @Type(() => Number)
  @IsInt()
  student_id!: number;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;
}
