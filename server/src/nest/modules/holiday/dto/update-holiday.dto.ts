import { PartialType } from '@nestjs/mapped-types';
import { CreateHolidayDto } from './create-holiday.dto.js';

export class UpdateHolidayDto extends PartialType(CreateHolidayDto) {}
