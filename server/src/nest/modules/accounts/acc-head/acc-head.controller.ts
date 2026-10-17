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
import { AccHeadService } from './acc-head.service.js';
import { CreateAccHeadDto } from './dto/create-acc-head.dto.js';
import { UpdateAccHeadDto } from './dto/update-acc-head.dto.js';

@Controller('acc-heads')
@UseGuards(Auth('admin'))
export class AccHeadController {
  constructor(private readonly heads: AccHeadService) {}

  @Get()
  findAll(@SchoolId() schoolId: number) {
    return this.heads.findAll(schoolId);
  }

  @Get(':id')
  findOne(@SchoolId() schoolId: number, @Param('id', ParseIntPipe) id: number) {
    return this.heads.findOne(schoolId, id);
  }

  @Post()
  create(@SchoolId() schoolId: number, @Body() dto: CreateAccHeadDto) {
    return this.heads.create(schoolId, dto);
  }

  @Patch(':id')
  update(
    @SchoolId() schoolId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAccHeadDto,
  ) {
    return this.heads.update(schoolId, id, dto);
  }

  @Delete(':id')
  remove(@SchoolId() schoolId: number, @Param('id', ParseIntPipe) id: number) {
    return this.heads.remove(schoolId, id);
  }
}
