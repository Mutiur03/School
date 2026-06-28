import path from "path";
import archiver from "archiver";
import * as XLSX from "xlsx";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/config/prisma.js";
import { redis } from "@/config/redis.js";
import { pdfQueue } from "@/utils/pdfQueue.js";
import { getUploadUrl, deleteFromR2, r2Client } from "@/config/r2.js";
import { ApiError } from "@/utils/ApiError.js";
import type { AdmissionPhotoUploadData } from "@school/shared-schemas";
import { formatQuota, generateAdmissionPDF } from "./admission-form-pdf.js";

export class DuplicateAdmissionFormError extends ApiError {
  duplicates: Array<{ field: string; message: string }>;

  constructor(duplicates: Array<{ field: string; message: string }>) {
    super(400, "Duplicate information found");
    this.duplicates = duplicates;
  }
}

const checkDuplicates = async (data: Record<string, any>, excludeId: string | null = null) => {
  const duplicates: Array<{ field: string; message: string }> = [];

  try {
    if (data?.admission_user_id) {
      const existing = await prisma.admission_form.findFirst({
        where: {
          admission_user_id: data.admission_user_id,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true, student_name_en: true },
      });
      if (existing) {
        duplicates.push({
          field: "admissionUserId",
          message: "A form with this User ID already exists",
        });
      }
    }
  } catch (err) {
    console.warn("checkDuplicates error:", err instanceof Error ? err.message : err);
  }

  try {
    if (data?.birth_reg_no) {
      const existing = await prisma.admission_form.findFirst({
        where: {
          birth_reg_no: data.birth_reg_no,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true, student_name_en: true },
      });
      if (existing) {
        duplicates.push({
          field: "birthRegNo",
          message: "A form with this Birth Registration number already exists",
        });
      }
    }
  } catch (err) {
    console.warn("checkDuplicates error:", err instanceof Error ? err.message : err);
  }

  return duplicates;
};

const queuePdfGeneration = async (id: string) => {
  const statusKey = `pdf:${id}:status`;
  await redis.set(statusKey, "generating");
  try {
    await pdfQueue.add(
      { admissionId: id },
      {
        jobId: `pdf:${id}`,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  } catch (queueErr) {
    console.error(
      "Failed to add PDF job to queue:",
      queueErr instanceof Error ? queueErr.message : queueErr,
    );
    await redis.set(statusKey, "failed");
  }
};

export class AdmissionFormService {
  static async getAdmissionUploadUrl(data: AdmissionPhotoUploadData) {
    const {
      filename,
      filetype,
      year,
      admissionClass,
      listType,
      name,
      serialNo,
    } = data;

    const safeYear = year || new Date().getFullYear();
    const safeListType = String(listType || "unknown")
      .trim()
      .replace(/[^a-zA-Z0-9-_]+/g, "_")
      .toLowerCase();
    const admissionClassSafe = admissionClass
      ? String(admissionClass)
          .trim()
          .replace(/[^a-zA-Z0-9-_]+/g, "_")
      : "unknown_class";

    const ext = path.extname(filename);
    const safeName = String(name || "")
      .trim()
      .replace(/[^a-zA-Z0-9-_]+/g, "_");
    const safeSerialNo = String(serialNo || "")
      .trim()
      .replace(/[^a-zA-Z0-9-_]+/g, "_");
    const safeFilename = `${safeSerialNo}_${safeName}`;
    const key = `admission/${safeYear}/${admissionClassSafe}/${safeListType}/${safeFilename}-${Date.now()}${ext}`;
    const url = await getUploadUrl(key, filetype);

    return { url, key };
  }

  static async createForm(body: Record<string, any>) {
    const settings = await prisma.admission.findFirst();
    const payload = { ...body };
    console.log(payload);
    delete payload.guardian_is_not_father;
    delete payload.guardian_address_same_as_permanent;

    if (!payload.admission_year && settings?.admission_year) {
      payload.admission_year = settings.admission_year;
    }

    payload.birth_year = payload.birth_reg_no?.slice(0, 4);
    payload.birth_date = [payload.birth_day, payload.birth_month, payload.birth_year]
      .filter(Boolean)
      .join("/");

    const duplicates = await checkDuplicates(payload);
    if (duplicates.length > 0) {
      throw new DuplicateAdmissionFormError(duplicates);
    }

    if (
      (!payload.admission_year || payload.admission_year === null) &&
      settings?.admission_year
    ) {
      payload.admission_year = settings.admission_year;
    }

    const photoPath = body.photo_path || null;
    const dataToCreate = { ...payload, photo_path: photoPath };

    const rec = await prisma.admission_form.create({ data: dataToCreate });
    await queuePdfGeneration(rec.id);

    return {
      id: rec.id,
      status: rec.status,
      submissionDate: rec.submission_date,
    };
  }

  static async getForms() {
    return prisma.admission_form.findMany({
      orderBy: { created_at: "desc" },
    });
  }

  static async getFormById(id: string) {
    const rec = await prisma.admission_form.findUnique({ where: { id } });
    if (!rec) {
      throw new ApiError(404, "Form not found");
    }
    return rec;
  }

  static async updateForm(id: string, body: Record<string, any>) {
    const existing = await prisma.admission_form.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError(404, "Form not found");
    }

    const payload = { ...body };
    delete payload.guardian_is_not_father;
    delete payload.guardian_address_same_as_permanent;
    payload.birth_year = payload.birth_reg_no?.slice(0, 4);
    payload.birth_date = [payload.birth_day, payload.birth_month, payload.birth_year].join("/");

    const duplicates = await checkDuplicates(payload, id);
    if (duplicates.length > 0) {
      throw new DuplicateAdmissionFormError(duplicates);
    }

    let photoPath = existing.photo_path;
    if (body.photo_path) {
      if (existing.photo_path && existing.photo_path !== body.photo_path) {
        await deleteFromR2(existing.photo_path);
      }
      photoPath = body.photo_path;
    }

    payload.whatsapp_number = payload.whatsapp_number?.trim() || "";

    const updated = await prisma.admission_form.update({
      where: { id },
      data: { ...payload, photo_path: photoPath },
    });
    console.log(updated);

    await queuePdfGeneration(id);
    return updated;
  }

  static async deleteForm(id: string) {
    const existing = await prisma.admission_form.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError(404, "Form not found");
    }

    if (existing.photo_path) {
      await deleteFromR2(existing.photo_path);
    }

    await prisma.admission_form.delete({ where: { id } });
  }

  static async approveForm(id: string) {
    const existing = await prisma.admission_form.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError(404, "Form not found");
    }

    return prisma.admission_form.update({
      where: { id },
      data: { status: "approved" },
    });
  }

  static async pendingForm(id: string) {
    const existing = await prisma.admission_form.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError(404, "Form not found");
    }

    return prisma.admission_form.update({
      where: { id },
      data: { status: "pending" },
    });
  }

  static async exportAllAdmissionsExcel(query: Record<string, unknown>) {
    const { status, search, admission_year, class: admissionClass } = query;
    const where: Record<string, any> = {};

    if (status && status !== "all") where.status = status;
    if (admission_year) {
      where.admission_year = Number(admission_year);
    }
    if (admissionClass) where.admission_class = admissionClass;
    if (search) {
      where.OR = [
        { student_name_en: { contains: String(search), mode: "insensitive" } },
        { student_name_bn: { contains: String(search), mode: "insensitive" } },
        { birth_reg_no: { contains: String(search), mode: "insensitive" } },
      ];
    }

    const items = await prisma.admission_form.findMany({
      where,
      orderBy: { created_at: "desc" },
    });

    let columns: string[] = [];
    if (items.length > 0) {
      columns = Object.keys(items[0]);
    } else {
      columns = [
        "id",
        "student_name_bn",
        "student_nick_name_bn",
        "student_name_en",
        "birth_reg_no",
        "registration_no",
        "father_name_bn",
        "father_name_en",
        "father_nid",
        "father_phone",
        "mother_name_bn",
        "mother_name_en",
        "mother_nid",
        "mother_phone",
        "birth_date",
        "birth_year",
        "birth_month",
        "birth_day",
        "blood_group",
        "email",
        "religion",
        "present_district",
        "present_upazila",
        "present_post_office",
        "present_post_code",
        "present_village_road",
        "permanent_district",
        "permanent_upazila",
        "permanent_post_office",
        "permanent_post_code",
        "permanent_village_road",
        "guardian_name",
        "guardian_phone",
        "guardian_relation",
        "guardian_nid",
        "guardian_district",
        "guardian_upazila",
        "guardian_post_office",
        "guardian_post_code",
        "guardian_village_road",
        "prev_school_name",
        "prev_school_district",
        "prev_school_upazila",
        "section_in_prev_school",
        "roll_in_prev_school",
        "prev_school_passing_year",
        "father_profession",
        "mother_profession",
        "parent_income",
        "admission_class",
        "list_type",
        "admission_user_id",
        "serial_no",
        "qouta",
        "whatsapp_number",
        "photo_path",
        "status",
        "submission_date",
        "created_at",
        "updated_at",
      ];
    }

    const rows: unknown[][] = [columns];
    items.forEach((a) => {
      const row = columns.map((col) => {
        let val = (a as Record<string, unknown>)[col];
        if (col === "qouta") {
          val = formatQuota(val);
        }
        if (val instanceof Date) return val.toISOString();
        if (val === null || typeof val === "undefined") return "";
        return String(val);
      });
      rows.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const colWidths: number[] = [];
    rows.forEach((r) => {
      r.forEach((cell, idx) => {
        const l = cell ? String(cell).length : 0;
        colWidths[idx] = Math.max(colWidths[idx] || 10, l + 2);
      });
    });
    ws["!cols"] = colWidths.map((w) => ({ wch: w }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Admissions");
    return XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
  }

  static async exportAdmissionImagesZip(query: Record<string, unknown>) {
    const { admission_year } = query;
    let yearNum: number | null = null;

    if (
      typeof admission_year !== "undefined" &&
      admission_year !== null &&
      String(admission_year).trim() !== ""
    ) {
      yearNum = Number(admission_year);
      if (isNaN(yearNum)) yearNum = null;
    }

    const fileName =
      yearNum !== null
        ? `admission_images_${String(yearNum)}.zip`
        : `admission_images_all_years.zip`;

    const archive = archiver("zip", { zlib: { level: 9 } });
    const where: Record<string, any> = { photo_path: { not: null } };
    if (yearNum !== null) {
      where.admission_year = yearNum;
    }

    const forms = await prisma.admission_form.findMany({
      where,
      select: { photo_path: true },
    });

    console.log(
      `Found ${forms.length} records with photos for export (Year: ${yearNum})`,
    );

    return { archive, forms, fileName };
  }

  static appendAdmissionImagesToArchive(
    archive: archiver.Archiver,
    forms: Array<{ photo_path: string | null }>,
  ) {
    return (async () => {
      let fileCount = 0;

      for (const form of forms) {
        const photoPath = form.photo_path;
        if (!photoPath) continue;
        try {
          const getCommand = new GetObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: photoPath,
          });
          const getResponse = await r2Client.send(getCommand);
          archive.append(getResponse.Body as any, { name: photoPath });
          fileCount++;
        } catch (err) {
          console.warn(
            `Failed to export image ${photoPath}:`,
            err instanceof Error ? err.message : err,
          );
        }
      }

      console.log(`Added ${fileCount} files to zip archive`);
      if (fileCount === 0) {
        console.warn("No files successfully added to the archive.");
      }

      await archive.finalize();
    })();
  }

  static async downloadPDF(id: string) {
    const admission = await prisma.admission_form.findUnique({ where: { id } });
    if (!admission) {
      throw new ApiError(404, "Admission not found");
    }

    return generateAdmissionPDF(admission);
  }
}

export { generateAdmissionPDF };
