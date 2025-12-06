import Bull from "bull";
import { prisma } from "../config/prisma.js";
import { generateAdmissionPDF } from "../controllers/admissionFormController.js";
import { redis } from "../config/redis.js";
import { TTL } from "../server.js";
const host = process.env.REDIS_HOST || "127.0.0.1";
const pdfQueue = new Bull("pdfQueue", {
  redis: { host: host, port: 6379 },
});
console.log("PDF worker started, waiting for jobs...");
pdfQueue.process(async (job) => {
  const { admissionId } = job.data;
  const statusKey = `pdf:${admissionId}:status`;
  const pdfKey = `pdf:${admissionId}`;
  console.log(`Processing PDF job for admissionId=${admissionId}`);
  const MAX_RETRIES = 2; 
  const RETRY_DELAY_MS = 1000; 

  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  let lastError = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await redis.set(statusKey, "generating", "EX", TTL);

      const admission = await prisma.admission_form.findUnique({
        where: { id: admissionId },
      });
      if (!admission) throw new Error("Admission not found");

      console.log(
        `generateAdmissionPDF started for admissionId: ${
          admission.id
        } (attempt ${attempt + 1})`
      );
      const pdfBuffer = await generateAdmissionPDF(admission);
      console.log(
        "generateAdmissionPDF finished, length:",
        pdfBuffer ? pdfBuffer.length : "null"
      );

      let buf;
      const originalType = Array.isArray(pdfBuffer)
        ? "array"
        : typeof pdfBuffer;
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
      console.log(
        `PDF job done for admissionId=${admissionId} (attempt ${attempt + 1})`
      );
      return true;
    } catch (err) {
      lastError = err;
      const msg =
        err && err.stack ? err.stack : err && err.message ? err.message : err;
      console.error(
        `PDF generation attempt ${attempt + 1} failed for ${admissionId}:`,
        msg
      );

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * (attempt + 1);
        console.log(
          `Retrying PDF generation for ${admissionId} in ${delay}ms...`
        );
        await sleep(delay);
        continue;
      }
      try {
        await redis.set(statusKey, "failed", "EX", TTL);
        const errorKey = `${pdfKey}:error`;
        try {
          await redis.set(errorKey, String(msg), "EX", TTL);
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
      throw lastError;
    }
  }
});

export { pdfQueue };
