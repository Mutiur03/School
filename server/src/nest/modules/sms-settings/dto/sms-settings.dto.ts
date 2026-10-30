import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Tenant-editable SMS settings. Credentials, provider and balance are super-admin only. */
export class UpdateSmsSettingsDto {
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  send_to_present?: boolean;

  @IsOptional()
  @IsBoolean()
  send_to_absent?: boolean;

  @IsOptional()
  @IsBoolean()
  send_to_run_awayed?: boolean;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  present_template?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  absent_template?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  run_awayed_template?: string;

  /** Placeholders every edited template must contain (the dashboard sends its list). */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  requiredPlaceholders?: string[];
}

export class TestSmsDto {
  @IsString()
  @IsNotEmpty({ message: 'phoneNumber is required' })
  phoneNumber!: string;

  @IsString()
  @IsNotEmpty({ message: 'message is required' })
  @MaxLength(1000)
  message!: string;
}

export class MessageCountQueryDto {
  @IsString()
  @IsNotEmpty({ message: 'Text parameter is required' })
  text!: string;
}
