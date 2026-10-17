import { Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Auth } from '../../../common/auth.guard.js';
import { SchoolId } from '../../../common/school-id.decorator.js';
import { CopyStructureDto, SetStructureDto, StructureQueryDto } from './dto/fee-structure.dto.js';
import { FeeStructureService } from './fee-structure.service.js';

@Controller('fee-structures')
@UseGuards(Auth('admin'))
export class FeeStructureController {
  constructor(private readonly structures: FeeStructureService) {}

  @Get()
  findAll(@SchoolId() schoolId: number, @Query() q: StructureQueryDto) {
    return this.structures.findAll(schoolId, q);
  }

  @Put()
  set(@SchoolId() schoolId: number, @Body() dto: SetStructureDto) {
    return this.structures.set(schoolId, dto);
  }

  @Post('copy')
  copy(@SchoolId() schoolId: number, @Body() dto: CopyStructureDto) {
    return this.structures.copy(schoolId, dto);
  }
}
