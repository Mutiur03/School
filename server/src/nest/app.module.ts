import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma.module.js';
import { AccountsModule } from './modules/accounts/accounts.module.js';
import { FeesModule } from './modules/fees/fees.module.js';
import { HolidayModule } from './modules/holiday/holiday.module.js';
import { CertificateModule } from './modules/certificate/certificate.module.js';
import { MarksModule } from './modules/marks/marks.module.js';
import { MarksheetsModule } from './modules/marksheets/marksheets.module.js';
import { PromotionModule } from './modules/promotion/promotion.module.js';
import { PublicResultsModule } from './modules/public-results/public-results.module.js';
import { LevelModule } from './modules/level/level.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { NoticeModule } from './modules/notice/notice.module.js';
import { EventsModule } from './modules/events/events.module.js';
import { CitizenCharterModule } from './modules/citizen-charter/citizen-charter.module.js';
import { SyllabusModule } from './modules/syllabus/syllabus.module.js';
import { ClassRoutineModule } from './modules/class-routine/class-routine.module.js';
import { StaffModule } from './modules/staff/staff.module.js';
import { GalleryModule } from './modules/gallery/gallery.module.js';
import { SmsSettingsModule } from './modules/sms-settings/sms-settings.module.js';
import { SmsLogsModule } from './modules/sms-logs/sms-logs.module.js';
import { SchoolCodesModule } from './modules/school-codes/school-codes.module.js';
import { SchoolModule } from './modules/school/school.module.js';

/** Migrated + new modules. Legacy Express routers live in src/app.ts until moved here. */
@Module({
  imports: [
    PrismaModule,
    HolidayModule,
    AccountsModule,
    FeesModule,
    MarksModule,
    MarksheetsModule,
    PublicResultsModule,
    PromotionModule,
    CertificateModule,
    SchoolCodesModule,
    LevelModule,
    DashboardModule,
    NoticeModule,
    EventsModule,
    CitizenCharterModule,
    SyllabusModule,
    ClassRoutineModule,
    StaffModule,
    GalleryModule,
    SmsSettingsModule,
    SmsLogsModule,
    SchoolModule,
  ],
})
export class AppModule {}
