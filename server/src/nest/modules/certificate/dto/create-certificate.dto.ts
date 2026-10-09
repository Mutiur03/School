import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min } from 'class-validator';
import {
  BANGLA_ONLY,
  NAME,
  PHONE_NUMBER,
  TESTIMONIAL_FIRST_YEAR,
  TESTIMONIAL_GENDERS,
} from '@school/shared-schemas';

/** Field shapes only; exam/year/roll/GPA/DOB rules are business rules checked in the service. */
export class CreateCertificateDto {
  @IsString()
  @IsNotEmpty()
  exam!: string;

  @IsInt()
  @Min(TESTIMONIAL_FIRST_YEAR)
  passing_year!: number;

  @Matches(BANGLA_ONLY)
  student_name_bn!: string;

  @Matches(NAME)
  student_name_en!: string;

  @Matches(BANGLA_ONLY)
  father_name_bn!: string;

  @Matches(NAME)
  father_name_en!: string;

  @Matches(BANGLA_ONLY)
  mother_name_bn!: string;

  @Matches(NAME)
  mother_name_en!: string;

  @Matches(PHONE_NUMBER)
  mobile!: string;

  @IsString()
  @IsNotEmpty()
  dob!: string;

  @IsOptional()
  @IsIn(TESTIMONIAL_GENDERS)
  gender?: (typeof TESTIMONIAL_GENDERS)[number];

  @IsOptional()
  @IsString()
  roll?: string;

  @IsOptional()
  @IsString()
  registration_no?: string;

  @IsOptional()
  @IsString()
  gpa?: string;
}
