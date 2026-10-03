import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateHolidayDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsDateString()
  start_date!: string;

  @IsDateString()
  end_date!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_optional?: boolean;
}
