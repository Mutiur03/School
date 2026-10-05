import { PartialType } from '@nestjs/mapped-types';
import { CreateVoucherDto } from './create-voucher.dto.js';

export class UpdateVoucherDto extends PartialType(CreateVoucherDto) {}
