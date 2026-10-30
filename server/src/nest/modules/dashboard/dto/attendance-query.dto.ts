import { Type } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';

export const ATTENDANCE_WINDOWS = [7, 15, 30] as const;

/** `?days=7|15|30` (default 7). */
export class AttendanceQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsIn(ATTENDANCE_WINDOWS, { message: 'days must be one of: 7, 15, 30' })
  days?: number;
}
