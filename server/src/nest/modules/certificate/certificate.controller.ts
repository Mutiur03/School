import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { SchoolId } from '../../common/school-id.decorator.js';
import { CertificateService } from './certificate.service.js';
import { CreateCertificateDto } from './dto/create-certificate.dto.js';
import { FindCertificateDto } from './dto/find-certificate.dto.js';
import { UpdateCertificateDto } from './dto/update-certificate.dto.js';
import { UpdateCertificateStatusDto } from './dto/update-certificate-status.dto.js';

// Public (no login): the record's random UUID, or year + mobile + DOB for lookup, is the access key.
@Controller('certificates')
export class CertificateController {
  constructor(private readonly certificates: CertificateService) {}

  @Get()
  findAll(@SchoolId() schoolId: number, @Query() query: FindCertificateDto) {
    return this.certificates.findAll(schoolId, query);
  }

  @Post()
  create(@SchoolId() schoolId: number, @Body() dto: CreateCertificateDto) {
    return this.certificates.create(schoolId, dto);
  }

  @Get(':id')
  findOne(@SchoolId() schoolId: number, @Param('id', ParseUUIDPipe) id: string) {
    return this.certificates.findOne(schoolId, id);
  }

  @Patch(':id')
  update(
    @SchoolId() schoolId: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCertificateDto,
  ) {
    return this.certificates.update(schoolId, id, dto);
  }

  /** Self-confirm only (pending → approved). Unlock is admin-only. */
  @Patch(':id/status')
  updateStatus(
    @SchoolId() schoolId: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCertificateStatusDto,
  ) {
    return this.certificates.updateStatus(schoolId, id, dto.status);
  }

  @Get(':id/pdf')
  @Header('Cache-Control', 'no-store')
  async pdf(@SchoolId() schoolId: number, @Param('id', ParseUUIDPipe) id: string) {
    const { buffer, name } = await this.certificates.generatePdf(schoolId, id);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `inline; filename="Certificate_${name}.pdf"`,
    });
  }
}
