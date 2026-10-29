import { IsIn } from 'class-validator';
import { UploadUrlQueryDto } from '../../../common/upload-url.dto.js';

export class EventUploadUrlQueryDto extends UploadUrlQueryDto {
  @IsIn(['image', 'file'], { message: 'type must be image or file' })
  type!: 'image' | 'file';
}
