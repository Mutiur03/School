import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ExamQueryDto, YearQueryDto } from '../../../common/query.dto.js';

/** ?class&year&exam */
export class ClassMarksQueryDto extends ExamQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  class!: number;
}

/** ?class&year&section */
export class RosterQueryDto extends YearQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  class!: number;

  @IsOptional()
  @IsString()
  section?: string;
}
