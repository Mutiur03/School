import logger from "@/utils/logger.js";
import { marksheetQueue } from "./marksheet.queue.js";
import { MarksheetService } from "./marksheet.service.js";

// Render is CPU-bound on the shared Node event loop. Default concurrency is
// low so a design-bump backfill does not stall jobs past Bull's lock.
// Override with MARKSHEET_WORKER_CONCURRENCY when needed.
const parsed = Number(process.env.MARKSHEET_WORKER_CONCURRENCY);
const CONCURRENCY = Math.max(
  1,
  Number.isFinite(parsed) && parsed > 0 ? parsed : 1,
);

/** Wait for active jobs before exit — under lockDuration (5 min). */
const DRAIN_TIMEOUT_MS = Number(
  process.env.MARKSHEET_DRAIN_TIMEOUT_MS || String(3 * 60 * 1000),
);
const DRAIN_POLL_MS = 2000;

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

/**
 * Pause local processing and wait for in-flight marksheet jobs to finish.
 * Call on SIGTERM/SIGINT before closing the HTTP server.
 */
export async function drainMarksheetQueue(
  timeoutMs: number = DRAIN_TIMEOUT_MS,
): Promise<void> {
  try {
    await marksheetQueue.pause(true);
  } catch (e) {
    logger.warn("[marksheet] drain: pause failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let active = 0;
    try {
      active = await marksheetQueue.getActiveCount();
    } catch (e) {
      logger.warn("[marksheet] drain: getActiveCount failed", {
        error: e instanceof Error ? e.message : String(e),
      });
      break;
    }
    if (active === 0) {
      logger.info("[marksheet] drain: no active jobs");
      return;
    }
    logger.info("[marksheet] drain: waiting for active jobs", {
      active,
      remainingMs: Math.max(0, deadline - Date.now()),
    });
    await new Promise((r) => setTimeout(r, DRAIN_POLL_MS));
  }

  const leftover = await marksheetQueue.getActiveCount().catch(() => -1);
  logger.warn("[marksheet] drain: timeout with jobs still active", {
    active: leftover,
    timeoutMs,
  });
}
