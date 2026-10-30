import { Module } from '@nestjs/common';
import { EventService } from './events.service.js';
import { EventsController } from './events.controller.js';

@Module({ providers: [EventService], controllers: [EventsController] })
export class EventsModule {}
