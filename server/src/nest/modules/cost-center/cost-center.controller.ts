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
import { Auth } from '../../common/auth.guard.js';
import { SchoolId } from '../../common/school-id.decorator.js';
import { CostCenterService } from './cost-center.service.js';
import { CreateCostCenterDto } from './dto/create-cost-center.dto.js';
import { UpdateCostCenterDto } from './dto/update-cost-center.dto.js';

@Controller('cost-centers')
@UseGuards(Auth('admin'))
export class CostCenterController {
  constructor(private readonly centers: CostCenterService) {}

  @Get()
  findAll(@SchoolId() schoolId: number) {
    return this.centers.findAll(schoolId);
  }

  @Get(':id')
  findOne(@SchoolId() schoolId: number, @Param('id', ParseIntPipe) id: number) {
    return this.centers.findOne(schoolId, id);
  }

  @Post()
  create(@SchoolId() schoolId: number, @Body() dto: CreateCostCenterDto) {
    return this.centers.create(schoolId, dto);
  }

  @Patch(':id')
  update(
    @SchoolId() schoolId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCostCenterDto,
  ) {
    return this.centers.update(schoolId, id, dto);
  }

  @Delete(':id')
  remove(@SchoolId() schoolId: number, @Param('id', ParseIntPipe) id: number) {
    return this.centers.remove(schoolId, id);
  }
}
