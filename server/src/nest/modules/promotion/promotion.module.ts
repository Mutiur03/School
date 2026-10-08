import { Module } from '@nestjs/common';
import { GraduationsController } from './graduations.controller.js';
import { PromotionService } from './promotion.service.js';
import { PromotionsController } from './promotions.controller.js';

@Module({
  controllers: [PromotionsController, GraduationsController],
  providers: [PromotionService],
})
export class PromotionModule {}
