import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma.module.js';
import { CertificateModule } from './modules/certificate/certificate.module.js';
import { HolidayModule } from './modules/holiday/holiday.module.js';

/** Migrated + new modules. Legacy Express routers live in src/app.ts until moved here. */
@Module({ imports: [PrismaModule, HolidayModule, CertificateModule] })
export class AppModule {}
