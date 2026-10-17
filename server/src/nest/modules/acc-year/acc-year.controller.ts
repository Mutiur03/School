import { Controller, Delete, Get, Param, ParseIntPipe, Put, UseGuards } from '@nestjs/common';
import { Auth } from '../../common/auth.guard.js';
import { SchoolId } from '../../common/school-id.decorator.js';
import { AccYearService } from './acc-year.service.js';

/** A closed year is the resource: PUT closes it, DELETE reopens it. */
@Controller('acc-years')
@UseGuards(Auth('admin'))
export class AccYearController {
  constructor(private readonly years: AccYearService) {}

  @Get()
  findAll(@SchoolId() schoolId: number) {
    return this.years.findAll(schoolId);
  }

  @Put(':year')
  update(@SchoolId() schoolId: number, @Param('year', ParseIntPipe) year: number) {
    return this.years.update(schoolId, year);
  }

  @Delete(':year')
  remove(@SchoolId() schoolId: number, @Param('year', ParseIntPipe) year: number) {
    return this.years.remove(schoolId, year);
  }
}
