import { Module } from '@nestjs/common';
import { PlatformSchoolsController } from './platform-schools.controller.js';
import { SchoolController } from './school.controller.js';

@Module({ controllers: [PlatformSchoolsController, SchoolController] })
export class SchoolModule {}
