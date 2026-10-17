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
import { Auth } from '../../../common/auth.guard.js';
import { SchoolId } from '../../../common/school-id.decorator.js';
import { CreateFeeWaiverDto, WaiverQueryDto } from './dto/create-fee-waiver.dto.js';
import { UpdateFeeWaiverDto } from './dto/update-fee-waiver.dto.js';
import { FeeWaiverService } from './fee-waiver.service.js';

@Controller('fee-waivers')
@UseGuards(Auth('admin'))
export class FeeWaiverController {
  constructor(private readonly waivers: FeeWaiverService) {}

  @Get()
  findAll(@SchoolId() schoolId: number, @Query() q: WaiverQueryDto) {
    return this.waivers.findAll(schoolId, q);
  }

  @Post()
  create(@SchoolId() schoolId: number, @Body() dto: CreateFeeWaiverDto) {
    return this.waivers.create(schoolId, dto);
  }

  @Patch(':id')
  update(
    @SchoolId() schoolId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFeeWaiverDto,
  ) {
    return this.waivers.update(schoolId, id, dto);
  }

  @Delete(':id')
  remove(@SchoolId() schoolId: number, @Param('id', ParseIntPipe) id: number) {
    return this.waivers.remove(schoolId, id);
  }
}
