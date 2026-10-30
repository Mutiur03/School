import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { BillingService } from '@/modules/billing/billing.service.js';
import { Auth } from '../../common/auth.guard.js';
import { SchoolId } from '../../common/school-id.decorator.js';
import { SchoolService } from './school.service.js';

/** The current tenant's school (resolved from the host by the tenant middleware). */
@Controller('school')
export class SchoolController {
  /** Public profile + branding; no auth. */
  @Get()
  async findOne(@SchoolId() schoolId: number) {
    const info = await SchoolService.getSchoolInfo(schoolId);
    if (!info) throw new NotFoundException('School not found');
    return info;
  }

  /** Readable while the subscription is locked (subscription-access.middleware.ts). */
  @Get('subscription-access')
  @UseGuards(Auth('admin', 'teacher', 'student'))
  subscriptionAccess(@SchoolId() schoolId: number) {
    return BillingService.getAccessForSchool(schoolId);
  }

  /** Readable while the subscription is locked. */
  @Get('billing')
  @UseGuards(Auth('admin'))
  billing(@SchoolId() schoolId: number) {
    return BillingService.getForSchool(schoolId);
  }
}
