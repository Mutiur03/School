import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export const CERTIFICATE_SORT_KEYS = [
  'name',
  'exam',
  'year',
  'mobile',
  'updated',
  'edits',
] as const;

/** Admin list query. Everything arrives as a string; multi-values are comma-separated. */
export class ListCertificateDto {
  @IsOptional()
  @Matches(/^\d{1,6}$/)
  page?: string;

  @IsOptional()
  @Matches(/^\d{1,3}$/)
  limit?: string;

  @IsOptional()
  @IsIn(CERTIFICATE_SORT_KEYS)
  sort?: (typeof CERTIFICATE_SORT_KEYS)[number];

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @Matches(/^\d{1,11}$/)
  mobile?: string;

  @IsOptional()
  @Matches(/^[A-Za-z0-9]{1,10}(,[A-Za-z0-9]{1,10}){0,9}$/)
  exam?: string;

  @IsOptional()
  @Matches(/^\d{4}(,\d{4}){0,49}$/)
  year?: string;

  @IsOptional()
  @IsIn(['edited', 'never'])
  edits?: 'edited' | 'never';
}
