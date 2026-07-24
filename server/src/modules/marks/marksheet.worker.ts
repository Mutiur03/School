import logger from "@/utils/logger.js";
import { marksheetQueue } from "./marksheet.queue.js";
import { MarksheetService } from "./marksheet.service.js";

// Render is CPU-bound on the shared Node event loop. Default concurrency is
// low so a design-bump backfill does not stall jobs past Bull's lock.
// Override with MARKSHEET_WORKER_CONCURRENCY when needed.
const parsed = Number(process.env.MARKSHEET_WORKER_CONCURRENCY);
const CONCURRENCY = Math.max(
  1,
  Number.isFinite(parsed) && parsed > 0 ? parsed :1,
);

let started = false;

/** Register the in-process marksheet worker. Call once at server startup. */
export function startMarksheetWorker(): void {
  if (started) return;
  started = true;

  marksheetQueue.process(CONCURRENCY, async (job) => {
    const d: any = job.data;
    logger.debug("[marksheet] worker: picked up job", {
      jobId: job.id,
      kind: d?.kind ?? "student",
      examId: d?.examId,
      target:
        d?.kind === "bundle"
          ? `class-${d?.class}:${d?.bundleSection ?? "ALL"}`
          : d?.kind === "session-student"
            ? `session-${d?.studentId}`
            : d?.kind === "session-year"
              ? `session-year-${d?.year}`
              : d?.studentId,
    });
    await MarksheetService.processJob(job.data);
    return true;
  });

  marksheetQueue.on("failed", (job, err) => {
    logger.warn("[marksheet] worker: job failed (Bull)", {
      jobId: job?.id,
      data: job?.data,
      attempts: job?.attemptsMade,
      error: err?.message,
    });
  });

  // When the queue drains, report it once so the log shows "all done".
  marksheetQueue.on("drained", async () => {
    try {
      const counts = await marksheetQueue.getJobCounts();
      logger.info("[marksheet] worker: queue drained", counts);
    } catch {
      logger.info("[marksheet] worker: queue drained");
    }
  });

  logger.info("[marksheet] worker: started", { concurrency: CONCURRENCY });

  // Recover stuck/pending sheets from a previous run, then apply design bumps.
  MarksheetService.recover()
    .then(() => MarksheetService.applyDesignVersionBumpIfNeeded())
    .catch((e) =>
      logger.warn("Marksheet recovery / design bump failed", {
        error: e instanceof Error ? e.message : String(e),
      }),
    );
}
