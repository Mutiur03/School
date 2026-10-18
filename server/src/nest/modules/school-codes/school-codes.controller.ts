import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Auth } from '../../common/auth.guard.js';
import { CurrentUser, type AuthUser } from '../../common/current-user.decorator.js';
import { SchoolId } from '../../common/school-id.decorator.js';
import { CreateSchoolCodeLookupDto } from './dto/create-school-code-lookup.dto.js';
import { CreateSchoolCodeDto } from './dto/create-school-code.dto.js';
import { LookupThrottleGuard } from './lookup-throttle.guard.js';
import {
  SchoolCodeLookupService,
  SchoolCodesService,
  tenantHostFor,
} from './school-codes.service.js';

/** Admin management of the current school's join codes. */
@Controller('school-codes')
@UseGuards(Auth('admin'))
export class SchoolCodesController {
  constructor(private readonly codes: SchoolCodesService) {}

  @Get()
  findAll(@SchoolId() schoolId: number) {
    return this.codes.findAll(schoolId);
  }

  @Post()
  create(
    @SchoolId() schoolId: number,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSchoolCodeDto,
  ) {
    return this.codes.create(schoolId, user?.id ?? null, dto);
  }

  @Delete(':id')
  remove(@SchoolId() schoolId: number, @Param('id', ParseIntPipe) id: number) {
    return this.codes.remove(schoolId, id);
  }
}

/**
 * Public, pre-tenant: turn a code into the school's public info and API host. Runs before any
 * school is known, so app.ts lets exactly this path through the tenant middleware.
 * POST (not GET) keeps codes out of URLs, access logs and caches.
 */
@Controller('school-code-lookups')
export class SchoolCodeLookupsController {
  constructor(private readonly lookups: SchoolCodeLookupService) {}

  @Post()
  @HttpCode(200)
  @UseGuards(LookupThrottleGuard)
  create(@Body() dto: CreateSchoolCodeLookupDto) {
    return this.lookups.create(dto.code, tenantHostFor);
  }
}

export const SCHOOL_CODE_LOOKUP_PATH = '/api/school-code-lookups';
