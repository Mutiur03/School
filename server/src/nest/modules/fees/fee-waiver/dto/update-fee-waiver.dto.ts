import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateFeeWaiverDto } from './create-fee-waiver.dto.js';

/** The student cannot change; delete and re-create instead. */
export class UpdateFeeWaiverDto extends PartialType(OmitType(CreateFeeWaiverDto, ['student_id'])) {}
