import { PartialType } from '@nestjs/mapped-types';
import { CreateCertificateDto } from './create-certificate.dto.js';

export class UpdateCertificateDto extends PartialType(CreateCertificateDto) {}
