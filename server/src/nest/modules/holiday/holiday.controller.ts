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
import { CreateHolidayDto } from './dto/create-holiday.dto.js';
import { UpdateHolidayDto } from './dto/update-holiday.dto.js';
import { HolidayService } from './holiday.service.js';

@Controller('holidays')
export class HolidayController {
  constructor(private readonly holidays: HolidayService) {}

  @Get()
  findAll(@SchoolId() schoolId: number) {
    return this.holidays.getHolidays(schoolId);
  }

  @Post()
  @UseGuards(Auth('admin'))
  create(@SchoolId() schoolId: number, @Body() dto: CreateHolidayDto) {
    return this.holidays.createHoliday(schoolId, dto);
  }

  @Patch(':id')
  @UseGuards(Auth('admin'))
  update(
    @SchoolId() schoolId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHolidayDto,
  ) {
    return this.holidays.updateHoliday(schoolId, id, dto);
  }

  @Delete(':id')
  @UseGuards(Auth('admin'))
  remove(@SchoolId() schoolId: number, @Param('id', ParseIntPipe) id: number) {
    return this.holidays.deleteHoliday(schoolId, id);
  }
}
