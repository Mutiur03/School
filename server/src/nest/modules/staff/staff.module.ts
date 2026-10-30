import { Module } from '@nestjs/common';
import { StaffService } from './staff.service.js';
import { StaffController } from './staff.controller.js';

@Module({ providers: [StaffService], controllers: [StaffController] })
export class StaffModule {}
