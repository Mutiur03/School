import { Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { Auth } from '../../common/auth.guard.js';
import { SchoolId } from '../../common/school-id.decorator.js';
import { CurrentUser } from '../../common/current-user.decorator.js';
import type { AuthUser } from '../../common/current-user.decorator.js';
import { PromotionService, ranBy } from './promotion.service.js';

/** Class 10 graduation for a session year. */
@Controller('graduations')
@UseGuards(Auth('admin'))
export class GraduationsController {
  constructor(private readonly promotion: PromotionService) {}

  @Post(':year')
  create(
    @SchoolId() schoolId: number,
    @Param('year', ParseIntPipe) year: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.promotion.graduate(schoolId, year, ranBy(user));
  }

  /** Dry run of the graduation. */
  @Get(':year/plan')
  findPlan(@SchoolId() schoolId: number, @Param('year', ParseIntPipe) year: number) {
    return this.promotion.previewGraduation(schoolId, year);
  }
}
