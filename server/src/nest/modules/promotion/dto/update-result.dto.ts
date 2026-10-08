import { IsIn } from 'class-validator';

export const ENROLLMENT_STATUSES = ['Passed', 'Failed', 'Pending', 'Graduated'];

export class UpdateResultDto {
  @IsIn(ENROLLMENT_STATUSES)
  status!: string;
}
