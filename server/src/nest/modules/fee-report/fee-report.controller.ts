import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { Auth } from '../../common/auth.guard.js';
import { pdfFile } from '../../common/pdf-file.js';
import { SchoolId } from '../../common/school-id.decorator.js';
import { CollectionQueryDto, DuesQueryDto, SummaryQueryDto } from './dto/fee-report.dto.js';
import { FeeReportService } from './fee-report.service.js';

@Controller('fee-reports')
@UseGuards(Auth('admin'))
export class FeeReportController {
  constructor(private readonly reports: FeeReportService) {}

  @Get('summary')
  summary(@SchoolId() schoolId: number, @Query() q: SummaryQueryDto) {
    return this.reports.summary(schoolId, q.date);
  }

  @Get('collection')
  collection(@SchoolId() schoolId: number, @Query() q: CollectionQueryDto) {
    return this.reports.collection(schoolId, q);
  }

  @Get('collection/pdf')
  @Header('Cache-Control', 'no-store')
  async collectionPdf(@SchoolId() schoolId: number, @Query() q: CollectionQueryDto) {
    const { buffer, name } = await this.reports.collectionPdf(schoolId, q);
    return pdfFile(buffer, `${name}.pdf`);
  }

  @Get('dues')
  dues(@SchoolId() schoolId: number, @Query() q: DuesQueryDto) {
    return this.reports.dues(schoolId, q);
  }

  @Get('dues/pdf')
  @Header('Cache-Control', 'no-store')
  async duesPdf(@SchoolId() schoolId: number, @Query() q: DuesQueryDto) {
    const { buffer, name } = await this.reports.duesPdf(schoolId, q);
    return pdfFile(buffer, `${name}.pdf`);
  }
}
