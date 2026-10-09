import { Matches } from 'class-validator';
import { PHONE_NUMBER } from '@school/shared-schemas';

/** Query params arrive as strings. */
export class FindCertificateDto {
  @Matches(/^\d{4}$/)
  passing_year!: string;

  @Matches(PHONE_NUMBER)
  mobile!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dob!: string;
}
