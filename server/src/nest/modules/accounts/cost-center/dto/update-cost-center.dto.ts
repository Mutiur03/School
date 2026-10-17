import { PartialType } from '@nestjs/mapped-types';
import { CreateCostCenterDto } from './create-cost-center.dto.js';

export class UpdateCostCenterDto extends PartialType(CreateCostCenterDto) {}
