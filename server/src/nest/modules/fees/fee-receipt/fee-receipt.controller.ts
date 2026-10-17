import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Auth } from '../../../common/auth.guard.js';
import { CurrentUser, type AuthUser } from '../../../common/current-user.decorator.js';
import { pdfFile } from '../../../common/pdf-file.js';
import { SchoolId } from '../../../common/school-id.decorator.js';
import {
  CreateFeeReceiptDto,
  ListReceiptsQueryDto,
  StatementQueryDto,
} from './dto/fee-receipt.dto.js';
import { FeeDueService } from './fee-due.service.js';
import { FeeReceiptPdfService } from './fee-receipt-pdf.service.js';
import { FeeReceiptService } from './fee-receipt.service.js';

@Controller('fee-receipts')
@UseGuards(Auth('admin'))
export class FeeReceiptController {
  constructor(
    private readonly receipts: FeeReceiptService,
    private readonly dues: FeeDueService,
    private readonly pdf: FeeReceiptPdfService,
  ) {}

  @Get()
  findAll(@SchoolId() schoolId: number, @Query() q: ListReceiptsQueryDto) {
    return this.receipts.findAll(schoolId, q);
  }

  /** What one student owes / has paid in a year: the collection screen's source of truth. */
  @Get('statement')
  findStatement(@SchoolId() schoolId: number, @Query() q: StatementQueryDto) {
    return this.dues.statement(schoolId, q.student_id, q.year);
  }

  @Get(':id')
  findOne(@SchoolId() schoolId: number, @Param('id', ParseIntPipe) id: number) {
    return this.receipts.findOne(schoolId, id);
  }

  @Get(':id/pdf')
  @Header('Cache-Control', 'no-store')
  async findPdf(@SchoolId() schoolId: number, @Param('id', ParseIntPipe) id: number) {
    const { buffer, name } = await this.pdf.generate(schoolId, id);
    return pdfFile(buffer, `${name}.pdf`);
  }

  @Post()
  create(
    @SchoolId() schoolId: number,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateFeeReceiptDto,
  ) {
    return this.receipts.create(schoolId, user?.id, dto);
  }

  @Delete(':id')
  remove(@SchoolId() schoolId: number, @Param('id', ParseIntPipe) id: number) {
    return this.receipts.remove(schoolId, id);
  }
}
