import { IsIn } from 'class-validator';

export class UpdateCertificateStatusDto {
  @IsIn(['pending', 'approved'])
  status!: 'pending' | 'approved';
}
