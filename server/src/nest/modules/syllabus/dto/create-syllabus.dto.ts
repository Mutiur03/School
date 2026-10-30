import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class CreateSyllabusDto {
  /** R2 key from `GET /syllabuses/upload-url`. */
  @IsString()
  @IsNotEmpty()
  key!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  class!: number;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;
}
