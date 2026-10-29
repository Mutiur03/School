import { PartialType } from '@nestjs/mapped-types';
import { StaffDto } from './create-staff.dto.js';

export class UpdateStaffDto extends PartialType(StaffDto) {}
