import { ArrayNotEmpty, IsInt } from 'class-validator';

/** Enrollments to hold or release. */
export class ResultEnrollmentsDto {
  @ArrayNotEmpty()
  @IsInt({ each: true })
  enrollment_ids!: number[];
}
