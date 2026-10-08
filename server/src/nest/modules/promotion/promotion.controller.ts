import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Auth } from '../../common/auth.guard.js';
import { SchoolId } from '../../common/school-id.decorator.js';
import { PassRulesDto } from './dto/pass-rules.dto.js';
import { UpdateEnrollmentStatusDto } from './dto/update-enrollment-status.dto.js';
import { PromotionService } from './promotion.service.js';

@Controller('promotion')
@UseGuards(Auth('admin'))
export class PromotionController {
  constructor(private readonly promotion: PromotionService) {}

  @Get(':year/results')
  findResults(
    @SchoolId() schoolId: number,
    @Param('year', ParseIntPipe) year: number,
    @Query('class', new ParseIntPipe({ optional: true })) classLevel?: number,
  ) {
    return this.promotion.getResults(schoolId, year, classLevel);
  }

  @Get(':year/stats')
  findStats(@SchoolId() schoolId: number, @Param('year', ParseIntPipe) year: number) {
    return this.promotion.getStats(schoolId, year);
  }

  @Post(':year/status')
  @HttpCode(200)
  generateStatus(@SchoolId() schoolId: number, @Param('year', ParseIntPipe) year: number) {
    return this.promotion.generateStatus(schoolId, year);
  }

  @Get(':year/pass-rules')
  findPassRules(@SchoolId() schoolId: number, @Param('year', ParseIntPipe) year: number) {
    return this.promotion.getPassRules(schoolId, year);
  }

  @Put(':year/pass-rules')
  updatePassRules(
    @SchoolId() schoolId: number,
    @Param('year', ParseIntPipe) year: number,
    @Body() dto: PassRulesDto,
  ) {
    return this.promotion.savePassRules(schoolId, year, dto.rules);
  }

  @Get(':year/preview')
  previewPromotion(@SchoolId() schoolId: number, @Param('year', ParseIntPipe) year: number) {
    return this.promotion.previewPromotion(schoolId, year);
  }

  @Post(':year/promote')
  @HttpCode(200)
  promote(@SchoolId() schoolId: number, @Param('year', ParseIntPipe) year: number) {
    return this.promotion.promote(schoolId, year);
  }

  @Get(':year/graduation/preview')
  previewGraduation(@SchoolId() schoolId: number, @Param('year', ParseIntPipe) year: number) {
    return this.promotion.previewGraduation(schoolId, year);
  }

  @Post(':year/graduation')
  @HttpCode(200)
  graduate(@SchoolId() schoolId: number, @Param('year', ParseIntPipe) year: number) {
    return this.promotion.graduate(schoolId, year);
  }

  @Patch('enrollments/:id/status')
  updateStatus(
    @SchoolId() schoolId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEnrollmentStatusDto,
  ) {
    return this.promotion.updateEnrollmentStatus(schoolId, id, dto.status);
  }
}
