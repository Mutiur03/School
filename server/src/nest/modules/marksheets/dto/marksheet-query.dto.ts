import { IsOptional, IsString } from 'class-validator';
import { ExamQueryDto } from '../../../common/query.dto.js';

/** ?year&exam&section (class bundle / summary; section optional) */
export class SectionExamQueryDto extends ExamQueryDto {
  @IsOptional()
  @IsString()
  section?: string;
}
