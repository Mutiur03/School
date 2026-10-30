import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

/** Same rules as `levelFormSchema` in @school/shared-schemas (used by the dashboard forms). */
export class CreateLevelDto {
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Class is required' })
  @Max(12, { message: 'Max class is 12' })
  class_name!: number;

  @IsString()
  @IsNotEmpty({ message: 'Section is required' })
  @MaxLength(10, { message: 'Section is too long' })
  section!: string;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Teacher is required' })
  teacher_id!: number;
}
