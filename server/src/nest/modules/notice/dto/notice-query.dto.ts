import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class NoticeQueryDto {
  /** Newest `limit` notices; omitted = all. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
