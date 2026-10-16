import { Module } from '@nestjs/common';
import { CertificateAdminController } from './certificate-admin.controller.js';
import { CertificateController } from './certificate.controller.js';
import { CertificatePdfService } from './certificate-pdf.service.js';
import { CertificateService } from './certificate.service.js';

@Module({
  controllers: [CertificateController, CertificateAdminController],
  providers: [CertificateService, CertificatePdfService],
})
export class CertificateModule {}
