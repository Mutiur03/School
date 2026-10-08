import {
  Body,
  Controller,
  Get,
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
import { UpdateResultDto } from './dto/update-result.dto.js';
import { PromotionService } from './promotion.service.js';

/** Year-end results (pass/fail + positions), pass rules, and the promotion run for a session year. */
@Controller('promotions')
@UseGuards(Auth('admin'))
export class PromotionsController {
  constructor(private readonly promotion: PromotionService) {}

  /** Run promotion of `year` into `year + 1`. */
  @Post(':year')
  create(@SchoolId() schoolId: number, @Param('year', ParseIntPipe) year: number) {
    return this.promotion.promote(schoolId, year);
  }

  /** Dry run of the promotion. */
  @Get(':year/plan')
  findPlan(@SchoolId() schoolId: number, @Param('year', ParseIntPipe) year: number) {
    return this.promotion.previewPromotion(schoolId, year);
  }

  @Get(':year/results')
  findAllResults(
    @SchoolId() schoolId: number,
    @Param('year', ParseIntPipe) year: number,
    @Query('class', new ParseIntPipe({ optional: true })) classLevel?: number,
  ) {
    return this.promotion.getResults(schoolId, year, classLevel);
  }

  /** Generate pass/fail + positions for the year. */
  @Post(':year/results')
  createResults(@SchoolId() schoolId: number, @Param('year', ParseIntPipe) year: number) {
    return this.promotion.createResults(schoolId, year);
  }

  /** Manual override; 404 when the enrollment is not in this school + year. */
  @Patch(':year/results/:enrollmentId')
  updateResult(
    @SchoolId() schoolId: number,
    @Param('year', ParseIntPipe) year: number,
    @Param('enrollmentId', ParseIntPipe) enrollmentId: number,
    @Body() dto: UpdateResultDto,
  ) {
    return this.promotion.updateResult(schoolId, year, enrollmentId, dto.status);
  }

  @Get(':year/stats')
  findStats(@SchoolId() schoolId: number, @Param('year', ParseIntPipe) year: number) {
    return this.promotion.getStats(schoolId, year);
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
}
