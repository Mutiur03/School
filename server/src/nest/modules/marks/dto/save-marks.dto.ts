import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class SubjectMarkDto {
  @IsInt()
  @Min(1)
  subjectId!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cq_marks?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  mcq_marks?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  practical_marks?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  marks?: number | null;
}

export class StudentMarksDto {
  @IsInt()
  @Min(1)
  studentId!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubjectMarkDto)
  subjectMarks!: SubjectMarkDto[];
}

/** PUT /marks: bulk upsert of one exam's marks. */
export class SaveMarksDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentMarksDto)
  students!: StudentMarksDto[];

  @IsString()
  @IsNotEmpty()
  examName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  year!: number;
}
/**
 * The format is:
 * {
 *   "students": [
 *     {
 *       "studentId": 1,
 *       "subjectMarks": [
 *         {
 *           "subjectId": 1,
 *           "cq_marks": 10,
 *           "mcq_marks": 10,
 *           "practical_marks": 10,
 *           "marks": 30
 *         }
 *       ]
 *     }
 *   ],
 *   "examName": "Half Yearly",
 *   "year": 2024
 * }
 */
