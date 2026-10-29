import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export const SCHOOL_ASSET_KINDS = ['logo', 'header', 'banner', 'hotline'] as const;

/** `GET /platform/schools/upload-url?filename&contentType&kind` (images only). */
export class SchoolAssetUploadQueryDto {
  @IsString()
  @IsNotEmpty()
  filename!: string;

  @IsString()
  @Matches(/^image\//, { message: 'Only image files are allowed' })
  contentType!: string;

  @IsOptional()
  @IsIn(SCHOOL_ASSET_KINDS)
  kind?: (typeof SCHOOL_ASSET_KINDS)[number];
}

/** `POST /platform/schools/:id/sms-balance-topups` */
export class SmsBalanceTopupDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  amount!: number;
}

/**
 * `PATCH /platform/schools/:id/sms-credentials`. `api_key` omitted = keep, `null` = switch to the
 * shared account, a string = own provider key. The service re-checks blanks and the provider.
 */
export class UpdateSmsCredentialsDto {
  @IsOptional()
  @IsString()
  api_key?: string | null;

  @IsOptional()
  @IsString()
  api_url?: string;

  @IsOptional()
  @IsString()
  sender_id?: string | null;

  @IsOptional()
  @IsString()
  service_type?: string | null;
}
