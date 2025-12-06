import Bull from "bull";
import { prisma } from "../config/prisma.js";
import { generateAdmissionPDF } from "../controllers/admissionFormController.js";
import { redis } from "../config/redis.js";
import { TTL } from "../server.js";

const pdfQueue = new Bull("pdfQueue", {
  redis: { host: "127.0.0.1", port: 6379 },
});
console.log("PDF worker started, waiting for jobs...");
pdfQueue.process(async (job) => {
  const { admissionId } = job.data;
  const statusKey = `pdf:${admissionId}:status`;
  const pdfKey = `pdf:${admissionId}`;
  console.log(`Processing PDF job for admissionId=${admissionId}`);
  try {
    await redis.set(statusKey, "generating", "EX", TTL);
    const JOB_TIMEOUT = Number(process.env.PDF_JOB_TIMEOUT_MS) || 30000;
    const admission = await prisma.admission_form.findUnique({
      where: { id: admissionId },
    });
    if (!admission) throw new Error("Admission not found");
    const pdfBuffer = await Promise.race([
      generateAdmissionPDF(admission),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("PDF generation worker timeout")),
          JOB_TIMEOUT
        )
      ),
    ]);
    let buf;
    const originalType = Array.isArray(pdfBuffer) ? "array" : typeof pdfBuffer;
    const ctorName =
      pdfBuffer && pdfBuffer.constructor
        ? pdfBuffer.constructor.name
        : "<none>";
    if (Buffer.isBuffer(pdfBuffer)) {
      buf = pdfBuffer;
    } else if (typeof pdfBuffer === "string") {
      buf = Buffer.from(pdfBuffer, "base64");
    } else if (
      (typeof ArrayBuffer !== "undefined" &&
        ArrayBuffer.isView &&
        ArrayBuffer.isView(pdfBuffer)) ||
      pdfBuffer instanceof ArrayBuffer ||
      Array.isArray(pdfBuffer)
    ) {
      buf = Buffer.from(pdfBuffer);
    } else {
      buf = Buffer.from(String(pdfBuffer));
      console.warn(
        `pdfWorker: unexpected pdfBuffer type for ${admissionId}: type=${originalType}, ctor=${ctorName}. Falling back to string conversion.`
      );
    }

    await redis.set(pdfKey, buf.toString("base64"), "EX", TTL);
    const headHex =
      buf && buf.slice(0, 16) ? buf.slice(0, 16).toString("hex") : "";
    console.log(
      `Saved PDF for ${admissionId}: originalType=${originalType}, ctor=${ctorName}, bytes=${buf.length}, head=${headHex}`
    );
    await redis.set(statusKey, "done", "EX", TTL);
    console.log(`PDF job done for admissionId=${admissionId}`);
    return true;
  } catch (err) {
    console.error(
      "PDF generation failed for",
      admissionId,
      err && err.message ? err.message : err
    );
    try {

      await redis.set(statusKey, "failed", "EX", TTL);
      const errorKey = `${pdfKey}:error`;
      try {
        await redis.set(
          errorKey,
          String(err && err.message ? err.message : err),
          "EX",
          TTL
        );
      } catch (e) {
        console.error(
          "Failed to save PDF error message to Redis:",
          e && e.message ? e.message : e
        );
      }
    } catch (e) {
      console.error(
        "Failed to set Redis status to failed:",
        e && e.message ? e.message : e
      );
    }
    throw err;
  }
});

export { pdfQueue };
