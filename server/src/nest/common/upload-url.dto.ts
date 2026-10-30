import { IsNotEmpty, IsString } from 'class-validator';

/** `GET /<resource>/upload-url?filename&contentType` → `{ uploadUrl, key }` (presigned PUT to R2). */
export class UploadUrlQueryDto {
  @IsString()
  @IsNotEmpty()
  filename!: string;

  @IsString()
  @IsNotEmpty()
  contentType!: string;
}

/** Body for routes that save an uploaded object by its R2 key. */
export class R2KeyDto {
  @IsString()
  @IsNotEmpty()
  key!: string;
}
