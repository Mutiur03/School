import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  ADDRESS_TEXT,
  DESIGNATION,
  EMAIL,
  NAME,
  PHONE_NUMBER,
  normalizeOptionalText,
} from '@school/shared-schemas';

/** Same normalisation as `staffFormSchema` (@school/shared-schemas): '' → null, phone → 01XXXXXXXXX. */
const optionalText = () => Transform(({ value }) => normalizeOptionalText(value));

export class StaffDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  @Matches(NAME, { message: 'Enter a valid name' })
  name!: string;

  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? `0${value.replace(/\D/g, '').slice(-10)}` : value,
  )
  @IsString({ message: 'Phone is required' })
  @Matches(PHONE_NUMBER, { message: 'Phone must be 11 digits and start with 01' })
  phone!: string;

  @IsOptional()
  @optionalText()
  @Matches(EMAIL, { message: 'Enter a valid email address' })
  email?: string | null;

  @IsOptional()
  @optionalText()
  @Matches(DESIGNATION, { message: 'Enter a valid designation' })
  designation?: string | null;

  @IsOptional()
  @optionalText()
  @Matches(ADDRESS_TEXT, { message: 'Enter a valid address' })
  address?: string | null;
}

/** `POST /staff` adds one or more members in one go. */
export class CreateStaffDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one staff member is required' })
  @ValidateNested({ each: true })
  @Type(() => StaffDto)
  staff!: StaffDto[];
}
