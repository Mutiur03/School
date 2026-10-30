import { PartialType } from '@nestjs/mapped-types';
import { CreateEventDto } from './create-event.dto.js';

export class UpdateEventDto extends PartialType(CreateEventDto) {}
