import { Module } from '@nestjs/common';
import { PromotionController } from './promotion.controller.js';
import { PromotionService } from './promotion.service.js';

@Module({ controllers: [PromotionController], providers: [PromotionService] })
export class PromotionModule {}
