import { PartialType } from '@nestjs/mapped-types';
import { CreateFeeHeadDto } from './create-fee-head.dto.js';

export class UpdateFeeHeadDto extends PartialType(CreateFeeHeadDto) {}
