import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { VALID_GROUPS } from '@school/shared-schemas';

/** PATCH /marks/students/:studentId/fourth-subject. `subjectId: null` clears it. */
export class UpdateFourthSubjectDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  year!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  subjectId?: number | null;
}

/** PATCH /marks/fourth-subjects: same 4th subject for a whole class 9/10 group. `subjectId: null` clears it. */
export class BulkUpdateFourthSubjectDto {
  @Type(() => Number)
  @IsIn([9, 10], { message: 'class must be 9 or 10' })
  class!: number;

  @Type(() => Number)
  @IsInt()
  @Min(2000, { message: 'Valid year is required' })
  year!: number;

  @IsIn(VALID_GROUPS, { message: `group must be one of: ${VALID_GROUPS.join(', ')}` })
  group!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  subjectId?: number | null;
}

/**
 * Payload formats:
 *
 * PATCH /marks/students/:studentId/fourth-subject
 * { "year": 2025, "subjectId": 12 }
 * { "year": 2025, "subjectId": null }
 *
 * PATCH /marks/fourth-subjects
 * { "class": 9, "year": 2025, "group": "A", "subjectId": 12 }
 * { "class": 9, "year": 2025, "group": "A", "subjectId": null }
 */
