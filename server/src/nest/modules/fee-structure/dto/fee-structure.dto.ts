import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class StructureQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  class?: number;
}

export class StructureItemDto {
  @IsInt()
  fee_head_id!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9_999_999_999.99)
  amount!: number;
}

/** Replaces the whole fee list of one class in one year. */
export class SetStructureDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  class!: number;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => StructureItemDto)
  items!: StructureItemDto[];
}

export class CopyStructureDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  from_year!: number;

  @IsInt()
  @Min(2000)
  @Max(2100)
  to_year!: number;
}
