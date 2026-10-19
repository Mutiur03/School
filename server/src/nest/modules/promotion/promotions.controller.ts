import {
  Body,
  Controller,
  Delete,
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
import { CurrentUser } from '../../common/current-user.decorator.js';
import type { AuthUser } from '../../common/current-user.decorator.js';
import { CorrectionsDto } from './dto/corrections.dto.js';
import { PassRulesDto } from './dto/pass-rules.dto.js';
import { ResultEnrollmentsDto } from './dto/result-enrollments.dto.js';
import { UpdateResultDto } from './dto/update-result.dto.js';
import { PromotionService, ranBy } from './promotion.service.js';

/** Year-end results (pass/fail + positions), pass rules, and the promotion run for a session year. */
@Controller('promotions')
@UseGuards(Auth('admin'))
export class PromotionsController {
  constructor(private readonly promotion: PromotionService) {}

  /** Run promotion of `year` into `year + 1`. */
  @Post(':year')
  create(
    @SchoolId() schoolId: number,
    @Param('year', ParseIntPipe) year: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.promotion.promote(schoolId, year, ranBy(user));
  }

  /** Number the failed class-6 students left without a roll by the promotion (run after importing admissions). */
  @Post(':year/retained')
  createRetained(@SchoolId() schoolId: number, @Param('year', ParseIntPipe) year: number) {
    return this.promotion.assignRetained(schoolId, year);
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

  /** Withhold results until released. */
  @Post(':year/results/holds')
  createHolds(
    @SchoolId() schoolId: number,
    @Param('year', ParseIntPipe) year: number,
    @Body() dto: ResultEnrollmentsDto,
  ) {
    return this.promotion.holdResults(schoolId, year, dto.enrollment_ids);
  }

  /** Release held results as a new batch; they rank after everyone already released. */
  @Post(':year/results/releases')
  createReleases(
    @SchoolId() schoolId: number,
    @Param('year', ParseIntPipe) year: number,
    @Body() dto: ResultEnrollmentsDto,
  ) {
    return this.promotion.releaseResults(schoolId, year, dto.enrollment_ids);
  }

  /** Where a status change would put the student next year (for the confirm dialog); nothing is written. */
  @Get(':year/results/:enrollmentId/placement')
  findPlacement(
    @SchoolId() schoolId: number,
    @Param('year', ParseIntPipe) year: number,
    @Param('enrollmentId', ParseIntPipe) enrollmentId: number,
    @Query() dto: UpdateResultDto,
  ) {
    return this.promotion.previewPlacement(schoolId, year, enrollmentId, dto.status);
  }

  /** Manual override; moves the student next year if already promoted. 404 when not in this school + year. */
  @Patch(':year/results/:enrollmentId')
  updateResult(
    @SchoolId() schoolId: number,
    @Param('year', ParseIntPipe) year: number,
    @Param('enrollmentId', ParseIntPipe) enrollmentId: number,
    @Body() dto: UpdateResultDto,
  ) {
    return this.promotion.updateResult(schoolId, year, enrollmentId, dto.status);
  }

  /** "Use calculated result": drop one manual pass/fail; the student moves if already promoted. */
  @Delete(':year/results/:enrollmentId/override')
  removeOverride(
    @SchoolId() schoolId: number,
    @Param('year', ParseIntPipe) year: number,
    @Param('enrollmentId', ParseIntPipe) enrollmentId: number,
  ) {
    return this.promotion.clearOverride(schoolId, year, enrollmentId);
  }

  /** What each correction would change (dry run for the "Correct mistakes" dialog). */
  @Get(':year/corrections/plan')
  findCorrectionsPlan(@SchoolId() schoolId: number, @Param('year', ParseIntPipe) year: number) {
    return this.promotion.previewCorrections(schoolId, year);
  }

  /** Apply the chosen corrections (reset promotion, undo graduation, clear manual, reset batches). */
  @Post(':year/corrections')
  createCorrections(
    @SchoolId() schoolId: number,
    @Param('year', ParseIntPipe) year: number,
    @Body() dto: CorrectionsDto,
  ) {
    return this.promotion.applyCorrections(schoolId, year, dto);
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
