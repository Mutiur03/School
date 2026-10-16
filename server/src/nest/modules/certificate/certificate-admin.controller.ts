import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Auth } from '../../common/auth.guard.js';
import { SchoolId } from '../../common/school-id.decorator.js';
import { CertificateService } from './certificate.service.js';
import { ListCertificateDto } from './dto/list-certificate.dto.js';
import { UpdateCertificateStatusDto } from './dto/update-certificate-status.dto.js';

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

  /** Approve or unlock (mark pending so the applicant can edit again). */
  @Patch(':id/status')
  updateStatus(
    @SchoolId() schoolId: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCertificateStatusDto,
  ) {
    return this.certificates.updateStatus(schoolId, id, dto.status, { asAdmin: true });
  }

  // Admin-only: any status (pending is stamped); prints the address unless ?address=false.
  @Get(':id/pdf')
  @Header('Cache-Control', 'no-store')
  async pdf(
    @SchoolId() schoolId: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('address', new ParseBoolPipe({ optional: true })) withAddress = true,
  ) {
    const { buffer, name } = await this.certificates.generatePdf(schoolId, id, {
      withAddress,
      asAdmin: true,
    });
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `inline; filename="Certificate_${name}.pdf"`,
    });
  }

  @Delete(':id')
  remove(@SchoolId() schoolId: number, @Param('id', ParseUUIDPipe) id: string) {
    return this.certificates.remove(schoolId, id);
  }
}
