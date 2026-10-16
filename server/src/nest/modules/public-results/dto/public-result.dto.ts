import { Expose, Transform, Type } from 'class-transformer';
import { Allow, IsInt, IsNotEmpty, IsString, Matches, Max, Min } from 'class-validator';
import { PHONE_NUMBER, SECTION } from '@school/shared-schemas';

// Same rules as the publicResult* zod schemas in packages/shared-schemas.
const CLASS_MSG = { message: 'Class must be between 1 and 10' };
const ROLL_MSG = { message: 'Roll must be a number between 1 and 999999' };

/** Public exam list: ?year&class */
export class PublicExamsQueryDto {
  @Type(() => Number)
  @IsInt({ message: 'Session must be a 4-digit year' })
  @Min(2000, { message: 'Session year is invalid' })
  @Max(2100, { message: 'Session year is invalid' })
  year!: number;

  @Type(() => Number)
  @IsInt(CLASS_MSG)
  @Min(1, CLASS_MSG)
  @Max(10, CLASS_MSG)
  class!: number;
}

/** Public result / marksheet: ?year&exam */
export class PublicResultQueryDto {
  @Type(() => Number)
  @IsInt({ message: 'Year must be a 4-digit number' })
  @Min(2000, { message: 'Year is invalid' })
  @Max(2100, { message: 'Year is invalid' })
  year!: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value), {
    toClassOnly: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'Exam is required' })
  exam!: string;
}

/** POST /public-results/verification. `session`/`mobile` are accepted aliases of `year`/`phone`. */
export class PublicResultVerifyDto {
  @Expose()
  @Transform(({ obj }) => Number(obj.year ?? obj.session), { toClassOnly: true })
  @IsInt({ message: 'Session must be a 4-digit year' })
  @Min(2000, { message: 'Session year is invalid' })
  @Max(2100, { message: 'Session year is invalid' })
  year!: number;

  @Allow()
  session?: unknown;

  @Type(() => Number)
  @IsInt(CLASS_MSG)
  @Min(1, CLASS_MSG)
  @Max(10, CLASS_MSG)
  class!: number;

  @Transform(
    ({ value }) =>
      String(value ?? '')
        .trim()
        .toUpperCase(),
    { toClassOnly: true },
  )
  @Matches(SECTION, { message: 'Section must be a single letter (A-Z)' })
  section!: string;

  @Type(() => Number)
  @IsInt(ROLL_MSG)
  @Min(1, ROLL_MSG)
  @Max(999999, ROLL_MSG)
  roll!: number;

  @Expose()
  @Transform(({ obj }) => String(obj.phone ?? obj.mobile ?? '').trim(), { toClassOnly: true })
  @Matches(PHONE_NUMBER, { message: 'Mobile must be 11 digits and start with 01' })
  phone!: string;

  @Allow()
  mobile?: unknown;
}
