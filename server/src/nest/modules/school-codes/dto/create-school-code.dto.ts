import { IsDateString, IsIn, IsOptional } from 'class-validator';

export const ROLE_HINTS = ['admin', 'teacher', 'student'] as const;
export type RoleHint = (typeof ROLE_HINTS)[number];

export class CreateSchoolCodeDto {
  @IsOptional()
  @IsIn(ROLE_HINTS)
  role_hint?: RoleHint;

  @IsOptional()
  @IsDateString()
  expires_at?: string;
}
