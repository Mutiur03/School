import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Auth } from '../../common/auth.guard.js';
import { SchoolId } from '../../common/school-id.decorator.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { EventUploadUrlQueryDto } from './dto/event-upload-url.dto.js';
import { UpdateEventDto } from './dto/update-event.dto.js';
import { EventService } from './events.service.js';

/** Events: public list, admin CRUD. Image/file go straight to R2 via `upload-url`. */
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventService) {}

  @Get()
  findAll(@SchoolId() schoolId: number) {
    return this.events.getEvents(schoolId);
  }

  @Get('upload-url')
  @UseGuards(Auth('admin'))
  uploadUrl(@Query() query: EventUploadUrlQueryDto) {
    return this.events.getPresignedUploadUrl(query.filename, query.contentType, query.type);
  }

  @Post()
  @UseGuards(Auth('admin'))
  create(@SchoolId() schoolId: number, @Body() dto: CreateEventDto) {
    return this.events.createEvent(dto, schoolId);
  }

  @Patch(':id')
  @UseGuards(Auth('admin'))
  update(
    @SchoolId() schoolId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEventDto,
  ) {
    return this.events.updateEvent(id, dto, schoolId);
  }

  @Delete(':id')
  @UseGuards(Auth('admin'))
  async remove(@SchoolId() schoolId: number, @Param('id', ParseIntPipe) id: number) {
    await this.events.deleteEvent(id, schoolId);
  }
}
