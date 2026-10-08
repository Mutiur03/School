import { IsIn } from 'class-validator';

export const ENROLLMENT_STATUSES = ['Passed', 'Failed', 'Pending', 'Graduated'];

export class UpdateEnrollmentStatusDto {
  @IsIn(ENROLLMENT_STATUSES)
  status!: string;
}
