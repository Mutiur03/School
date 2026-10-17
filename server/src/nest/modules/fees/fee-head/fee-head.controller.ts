import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Auth } from '../../../common/auth.guard.js';
import { SchoolId } from '../../../common/school-id.decorator.js';
import { FeeHeadService } from './fee-head.service.js';
import { CreateFeeHeadDto } from './dto/create-fee-head.dto.js';
import { UpdateFeeHeadDto } from './dto/update-fee-head.dto.js';

@Controller('fee-heads')
@UseGuards(Auth('admin'))
export class FeeHeadController {
  constructor(private readonly heads: FeeHeadService) {}

  @Get()
  findAll(@SchoolId() schoolId: number) {
    return this.heads.findAll(schoolId);
  }

  @Get(':id')
  findOne(@SchoolId() schoolId: number, @Param('id', ParseIntPipe) id: number) {
    return this.heads.findOne(schoolId, id);
  }

  @Post()
  create(@SchoolId() schoolId: number, @Body() dto: CreateFeeHeadDto) {
    return this.heads.create(schoolId, dto);
  }

  @Patch(':id')
  update(
    @SchoolId() schoolId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFeeHeadDto,
  ) {
    return this.heads.update(schoolId, id, dto);
  }

  @Delete(':id')
  remove(@SchoolId() schoolId: number, @Param('id', ParseIntPipe) id: number) {
    return this.heads.remove(schoolId, id);
  }
}
