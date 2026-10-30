import { Module } from '@nestjs/common';
import { NoticeService } from './notice.service.js';
import { NoticeController } from './notice.controller.js';

@Module({ providers: [NoticeService], controllers: [NoticeController] })
export class NoticeModule {}
