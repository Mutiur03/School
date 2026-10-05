import { PartialType } from '@nestjs/mapped-types';
import { CreateAccHeadDto } from './create-acc-head.dto.js';

export class UpdateAccHeadDto extends PartialType(CreateAccHeadDto) {}
