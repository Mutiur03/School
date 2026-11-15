import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class ExamResultFilesQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  examId!: number;
}
