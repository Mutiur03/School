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
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  createSchoolSchema,
  updateSchoolSchema,
  updateSubscriptionSchema,
  type CreateSchoolSchemaData,
  type UpdateSchoolSchemaData,
  type UpdateSubscriptionData,
} from '@school/shared-schemas';
import { BillingService } from '@/modules/billing/billing.service.js';
import { Auth } from '../../common/auth.guard.js';
import { ZodBodyPipe } from '../../common/zod-body.pipe.js';
import { SmsSettingsService } from '../sms-settings/sms-settings.service.js';
import {
  SchoolAssetUploadQueryDto,
  SmsBalanceTopupDto,
  UpdateSmsCredentialsDto,
} from './dto/school.dto.js';
import { XLSX_TYPE, schoolAssetUploadUrl } from './school-assets.js';
import { SchoolService } from './school.service.js';

const xlsx = (buffer: Buffer, filename: string) =>
  new StreamableFile(buffer, {
    type: XLSX_TYPE,
    disposition: `attachment; filename="${filename}"`,
  });

/**
 * Platform (super-admin) school management. Pre-tenant: app.ts lets `/api/platform/*` skip the
 * tenant lookup, so no school context exists here; the school is always the `:id` in the path.
 */
@Controller('platform')
@UseGuards(Auth('super_admin'))
export class PlatformSchoolsController {
  @Get('schools')
  findAll() {
    return SchoolService.getSchools();
  }

  @Post('schools')
  create(@Body(new ZodBodyPipe(createSchoolSchema)) dto: CreateSchoolSchemaData) {
    return SchoolService.createSchool(dto);
  }

  @Get('schools/upload-url')
  uploadUrl(@Query() q: SchoolAssetUploadQueryDto) {
    return schoolAssetUploadUrl(q.filename, q.contentType, q.kind);
  }

  @Put('schools/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodBodyPipe(updateSchoolSchema)) dto: UpdateSchoolSchemaData,
  ) {
    return SchoolService.updateSchool(id, dto);
  }

  @Get('schools/:id/billing')
  billing(@Param('id', ParseIntPipe) id: number) {
    return BillingService.getForSchool(id);
  }

  @Put('schools/:id/billing')
  updateBilling(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodBodyPipe(updateSubscriptionSchema)) dto: UpdateSubscriptionData,
  ) {
    return BillingService.updateForSchool(id, dto);
  }

  @Post('schools/:id/student-password-rotations')
  async rotateStudentPasswords(@Param('id', ParseIntPipe) id: number) {
    const buffer = await SchoolService.rotateStudentPasswords(id);
    return xlsx(buffer, `school-${id}-rotated-passwords.xlsx`);
  }

  @Get('schools/:id/student-export')
  async exportStudents(@Param('id', ParseIntPipe) id: number) {
    const buffer = await SchoolService.exportStudentsExcel(id);
    return xlsx(buffer, `school-${id}-students.xlsx`);
  }

  @Get('sms-overview')
  smsOverview() {
    return SmsSettingsService.getOverview();
  }

  @Get('schools/:id/sms-credentials')
  smsCredentials(@Param('id', ParseIntPipe) id: number) {
    return SmsSettingsService.getCredentialsForSchool(id);
  }

  @Patch('schools/:id/sms-credentials')
  updateSmsCredentials(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSmsCredentialsDto,
  ) {
    return SmsSettingsService.updateCredentialsForSchool(id, { ...dto });
  }

  @Post('schools/:id/sms-balance-topups')
  topUpSms(@Param('id', ParseIntPipe) id: number, @Body() dto: SmsBalanceTopupDto) {
    return SmsSettingsService.addBalanceForSchool(id, dto.amount);
  }
}
