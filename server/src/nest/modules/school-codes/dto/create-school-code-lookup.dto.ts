import { IsString, MaxLength } from 'class-validator';

/** Body of POST /api/school-code-lookups. The format is checked in the service, not here, so
 * every bad code gets the same generic 404 instead of a validation message. */
export class CreateSchoolCodeLookupDto {
  @IsString()
  @MaxLength(32)
  code!: string;
}
