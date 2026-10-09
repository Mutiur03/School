import {
  Body,
  Controller,
  Get,
  Header,
  Ip,
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

// Public (no login): the record's random UUID, or year + mobile + DOB for lookup, is the access key.
@Controller('certificates')
export class CertificateController {
  constructor(private readonly certificates: CertificateService) {}

  @Get()
  findAll(@SchoolId() schoolId: number, @Query() query: FindCertificateDto) {
    return this.certificates.findAll(schoolId, query);
  }

  @Post()
  create(@SchoolId() schoolId: number, @Body() dto: CreateCertificateDto, @Ip() ip: string) {
    return this.certificates.create(schoolId, dto, ip);
  }

  @Patch(':id')
  update(
    @SchoolId() schoolId: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCertificateDto,
    @Ip() ip: string,
  ) {
    return this.certificates.update(schoolId, id, dto, ip);
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
