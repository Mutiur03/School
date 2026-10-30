import { Module } from '@nestjs/common';
import { ClassRoutineService } from './class-routine.service.js';
import { ClassRoutineController } from './class-routine.controller.js';

@Module({
  providers: [ClassRoutineService],
  controllers: [ClassRoutineController],
})
export class ClassRoutineModule {}
