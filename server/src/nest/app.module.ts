import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma.module.js';
import { HolidayModule } from './modules/holiday/holiday.module.js';
import { PromotionModule } from './modules/promotion/promotion.module.js';

/** Migrated + new modules. Legacy Express routers live in src/app.ts until moved here. */
@Module({ imports: [PrismaModule, HolidayModule, PromotionModule] })
export class AppModule {}
