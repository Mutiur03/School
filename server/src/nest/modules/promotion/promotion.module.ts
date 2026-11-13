import { Module } from '@nestjs/common';
import { MarksheetsModule } from '../marksheets/marksheets.module.js';
import { GraduationsController } from './graduations.controller.js';
import { FinalResultService } from './final-result.service.js';
import { PromotionService } from './promotion.service.js';
import { PromotionsController } from './promotions.controller.js';

@Module({
  imports: [MarksheetsModule],
  controllers: [PromotionsController, GraduationsController],
  providers: [PromotionService, FinalResultService],
})
export class PromotionModule {}
