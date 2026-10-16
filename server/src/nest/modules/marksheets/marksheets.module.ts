import { Module } from '@nestjs/common';
import { MarksheetCacheService } from './cache/marksheet-cache.service.js';
import { MarksheetHashService } from './cache/marksheet-hash.service.js';
import { MarksheetJobsService } from './jobs/marksheet-jobs.service.js';
import { marksheetQueueProvider } from './jobs/marksheet.queue.js';
import { MarksheetWorker } from './jobs/marksheet.worker.js';
import { MarksheetsController } from './marksheets.controller.js';
import { ClassSummaryService } from './pdf/class-summary.service.js';
import { MarksheetRenderer } from './pdf/marksheet-renderer.js';

/** Marksheet PDFs: renderer, R2 cache (hash + serve/invalidate), Bull jobs + worker. */
@Module({
  controllers: [MarksheetsController],
  providers: [
    marksheetQueueProvider,
    MarksheetRenderer,
    MarksheetHashService,
    MarksheetCacheService,
    MarksheetJobsService,
    MarksheetWorker,
    ClassSummaryService,
  ],
  exports: [MarksheetRenderer, MarksheetCacheService],
})
export class MarksheetsModule {}
