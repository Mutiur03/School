import { prisma } from "../config/prisma.js";
import { generateAdmissionPDF } from "../controllers/admissionFormController.js";
import { redis } from "../config/redis.js";
const TTL = process.env.PDF_CACHE_TTL || "300";
import { pdfQueue } from "./pdfQueue.js";
console.log("PDF worker started, waiting for jobs...");
pdfQueue.process(1, async (job) => {
  console.log("Job Data", job.data);
  const { admissionId } = job.data;
  const statusKey = `pdf:${admissionId}:status`;
  const pdfKey = `pdf:${admissionId}`;
  console.log(`Processing PDF job for admissionId=${admissionId}`);
  await redis.set(statusKey, "generating", "EX", TTL);
  console.log(`Admission ID ${admissionId}`);
  const admission = await prisma.admission_form.findUnique({
    where: { id: admissionId },
  });
  console.log(`Fetched admission for ID ${admissionId} `);
  console.log(admission);

  if (!admission) throw new Error("Admission not found");

  console.log(`generateAdmissionPDF started for admissionId: ${admission.id}`);
  const pdfBuffer = await generateAdmissionPDF(admission);
  console.log(
    "generateAdmissionPDF finished, length:",
    pdfBuffer ? pdfBuffer.length : "null"
  );

  let buf;
  const originalType = Array.isArray(pdfBuffer) ? "array" : typeof pdfBuffer;
  const ctorName =
    pdfBuffer && pdfBuffer.constructor ? pdfBuffer.constructor.name : "<none>";
  if (!pdfBuffer || (Buffer.isBuffer(pdfBuffer) && pdfBuffer.length < 4)) {
    throw new Error("PDF generation returned empty buffer");
  }
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
  console.log(`PDF job done for admissionId=${admissionId})`);
  return true;
});
pdfQueue.on("failed", (job, err) => {
  console.error("PDF job failed:", job.data, err.message);
});
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);
