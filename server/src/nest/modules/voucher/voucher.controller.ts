import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Auth } from '../../common/auth.guard.js';
import { SchoolId } from '../../common/school-id.decorator.js';
import { CreateVoucherDto } from './dto/create-voucher.dto.js';
import { ListVouchersQueryDto } from './dto/list-vouchers-query.dto.js';
import { UpdateVoucherDto } from './dto/update-voucher.dto.js';
import { VoucherService } from './voucher.service.js';

@Controller('vouchers')
@UseGuards(Auth('admin'))
export class VoucherController {
  constructor(private readonly vouchers: VoucherService) {}

  @Get()
  findAll(@SchoolId() schoolId: number, @Query() query: ListVouchersQueryDto) {
    return this.vouchers.findAll(schoolId, query);
  }

  @Get(':id')
  findOne(@SchoolId() schoolId: number, @Param('id', ParseIntPipe) id: number) {
    return this.vouchers.findOne(schoolId, id);
  }

  @Post()
  create(@SchoolId() schoolId: number, @Body() dto: CreateVoucherDto) {
    return this.vouchers.create(schoolId, dto);
  }

  @Patch(':id')
  update(
    @SchoolId() schoolId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVoucherDto,
  ) {
    return this.vouchers.update(schoolId, id, dto);
  }

  @Delete(':id')
  remove(@SchoolId() schoolId: number, @Param('id', ParseIntPipe) id: number) {
    return this.vouchers.remove(schoolId, id);
  }
}
