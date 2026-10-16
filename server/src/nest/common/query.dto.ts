import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

/** ?year (session year), shared by marks, marksheets and public results. */
export class YearQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  year!: number;
}

/** ?year&exam (exam = exam name) */
export class ExamQueryDto extends YearQueryDto {
  @IsString()
  @IsNotEmpty()
  exam!: string;
}
