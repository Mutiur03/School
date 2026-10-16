import { Matches } from 'class-validator';
import { NID, PHONE_NUMBER } from '@school/shared-schemas';

/** Query params arrive as strings. Batch + phone + class + birth reg/NID is the unique key. */
export class FindCertificateDto {
  @Matches(/^\d{4}$/)
  passing_year!: string;

  @Matches(PHONE_NUMBER)
  mobile!: string;

  @Matches(/^(SSC|JSC|6|7|8)$/)
  exam!: string;

  @Matches(NID)
  birth_reg_no!: string;
}
