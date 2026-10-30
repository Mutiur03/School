import { PartialType } from '@nestjs/mapped-types';
import { CreateNoticeDto } from './create-notice.dto.js';

export class UpdateNoticeDto extends PartialType(CreateNoticeDto) {}
