import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Auth } from '../../common/auth.guard.js';
import { CurrentUser } from '../../common/current-user.decorator.js';
import type { AuthUser } from '../../common/current-user.decorator.js';
import {
  BulkSmsDto,
  RecipientCountQueryDto,
  SmsLogIdsDto,
  SmsLogsQueryDto,
  UsageQueryDto,
} from './dto/sms-logs.dto.js';
import { SmsLogsService } from './sms-logs.service.js';

/** Business-rule failures the shared service reports as plain Errors. */
const BULK_RULE_ERRORS = [
  'Please select at least one class.',
  'Message content cannot be empty.',
  'No students found in the selected classes.',
];

/** The shared service returns `{ status, body }`; non-2xx become exceptions, 2xx bodies are the data. */
const unwrap = <R extends { status: number; body: unknown }>(result: R): R['body'] => {
  if (result.status >= 400) {
    const body = result.body as { error?: string; message?: string };
    throw new HttpException(body.error ?? body.message ?? 'Request failed', result.status);
  }
  return result.body;
};

/** SMS logs, usage and bulk sends (admin). Static service: shared with Express attendance. */
@Controller('sms')
@UseGuards(Auth('admin'))
export class SmsLogsController {
  @Get('logs')
  findLogs(@Query() query: SmsLogsQueryDto, @CurrentUser() user: AuthUser) {
    return SmsLogsService.getSmsLogs(query, user);
  }

  @Delete('logs')
  async removeLogs(@Body() dto: SmsLogIdsDto) {
    return unwrap(await SmsLogsService.deleteSmsLogs(dto.ids));
  }

  @Post('logs/retries')
  async retry(@Body() dto: SmsLogIdsDto) {
    return unwrap(await SmsLogsService.retrySms(dto.ids));
  }

  @Get('usage')
  async usage(@Query() query: UsageQueryDto) {
    return unwrap(await SmsLogsService.getSmsUsageStats(query.days ?? 30));
  }

  @Post('bulk-messages')
  async sendBulk(@Body() dto: BulkSmsDto) {
    try {
      return await SmsLogsService.sendBulkSmsByClass(dto.classNames, dto.message);
    } catch (error) {
      if (error instanceof Error && BULK_RULE_ERRORS.includes(error.message)) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Get('recipient-counts')
  recipientCounts(@Query() query: RecipientCountQueryDto) {
    return SmsLogsService.getStudentCountByClasses(query.classes);
  }
}
