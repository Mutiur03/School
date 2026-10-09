import { Controller, Delete, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { Auth } from '../../common/auth.guard.js';
import { SchoolId } from '../../common/school-id.decorator.js';
import { CertificateService } from './certificate.service.js';
import { ListCertificateDto } from './dto/list-certificate.dto.js';

/** Staff view of the public certificates: full details and the edit history. */
@Controller('admin/certificates')
@UseGuards(Auth('admin'))
export class CertificateAdminController {
  constructor(private readonly certificates: CertificateService) {}

  @Get()
  findAll(@SchoolId() schoolId: number, @Query() query: ListCertificateDto) {
    return this.certificates.findAllForAdmin(schoolId, query);
  }

  @Get(':id/revisions')
  history(@SchoolId() schoolId: number, @Param('id', ParseUUIDPipe) id: string) {
    return this.certificates.history(schoolId, id);
  }

  @Delete(':id')
  remove(@SchoolId() schoolId: number, @Param('id', ParseUUIDPipe) id: string) {
    return this.certificates.remove(schoolId, id);
  }
}
