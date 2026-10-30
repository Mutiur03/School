import { PartialType } from '@nestjs/mapped-types';
import { CreateLevelDto } from './create-level.dto.js';

export class UpdateLevelDto extends PartialType(CreateLevelDto) {}
