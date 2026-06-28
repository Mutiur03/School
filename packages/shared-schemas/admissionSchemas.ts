import { z } from "zod";
import { registrationNoticeUploadSchema } from "./class6RegistrationSchemas.js";

export const admissionSettingsSchema = z.object({
  admission_year: z.union([z.string(), z.number()]).optional(),
  admission_open: z.union([z.string(), z.boolean()]).optional(),
  instruction: z.string().optional(),
  attachment_instruction_class6: z.string().optional(),
  attachment_instruction_class7: z.string().optional(),
  attachment_instruction_class8: z.string().optional(),
  attachment_instruction_class9: z.string().optional(),
  ingikar: z.string().optional(),
  class_list: z.string().optional(),
  list_type_class6: z.string().optional(),
  list_type_class7: z.string().optional(),
  list_type_class8: z.string().optional(),
  list_type_class9: z.string().optional(),
  user_id_class6: z.string().optional(),
  user_id_class7: z.string().optional(),
  user_id_class8: z.string().optional(),
  user_id_class9: z.string().optional(),
  serial_no_class6: z.string().optional(),
  serial_no_class7: z.string().optional(),
  serial_no_class8: z.string().optional(),
  serial_no_class9: z.string().optional(),
  notice_key: z.string().nullable().optional(),
});

export const admissionNoticeUploadSchema = registrationNoticeUploadSchema.refine(
  (data) => data.filetype === "application/pdf",
  { message: "Only PDF files are allowed", path: ["filetype"] },
);

export const admissionPhotoUploadSchema = z.object({
  filename: z.string().min(1, "Filename is required"),
  filetype: z.string().min(1, "Filetype is required"),
  year: z.union([z.string(), z.number()]).optional(),
  admissionClass: z.string().optional(),
  listType: z.string().optional(),
  name: z.string().optional(),
  serialNo: z.string().optional(),
});

const admissionResultListTypeSchema = z.enum([
  "merit_list",
  "waiting_list_1",
  "waiting_list_2",
]);

const admissionResultYearSchema = z
  .union([z.string(), z.number()])
  .transform((value) =>
    typeof value === "string" ? parseInt(value, 10) : value,
  )
  .pipe(z.number().int().positive("Admission year must be a positive integer"));

const admissionResultUploadFileSchema = z.object({
  filename: z.string().trim().min(1, "Filename is required"),
  contentType: z.string().trim().min(1, "Content type is required"),
  fileSize: z
    .number()
    .positive("File size must be greater than 0")
    .max(
      5 * 1024 * 1024 * 1024,
      "File size exceeds maximum allowed size",
    ),
  type: admissionResultListTypeSchema,
});

export const admissionResultUploadRequestSchema = z.object({
  files: z
    .array(admissionResultUploadFileSchema)
    .min(1, "At least one file is required"),
  className: z.string().trim().min(1, "Class name is required"),
  admissionYear: admissionResultYearSchema,
});

export const admissionResultCreateSchema = z.object({
  class_name: z.string().trim().min(1, "Class name is required"),
  admission_year: admissionResultYearSchema,
  merit_list: z.string().nullable().optional(),
  waiting_list_1: z.string().nullable().optional(),
  waiting_list_2: z.string().nullable().optional(),
});

export const admissionResultUpdateSchema = z.object({
  class_name: z.string().trim().min(1, "Class name is required").optional(),
  admission_year: admissionResultYearSchema.optional(),
  merit_list: z.string().nullable().optional(),
  waiting_list_1: z.string().nullable().optional(),
  waiting_list_2: z.string().nullable().optional(),
});

export const admissionResultMultipartSignSchema = z.object({
  key: z.string().trim().min(1, "Key is required"),
  uploadId: z.string().trim().min(1, "Upload ID is required"),
  partNumber: z
    .union([z.string(), z.number()])
    .transform((value) =>
      typeof value === "string" ? parseInt(value, 10) : value,
    )
    .pipe(z.number().int().positive("Part number must be a positive integer")),
});

export const admissionResultMultipartCompleteSchema = z.object({
  key: z.string().trim().min(1, "Key is required"),
  uploadId: z.string().trim().min(1, "Upload ID is required"),
  parts: z
    .array(
      z.object({
        ETag: z.string().min(1, "ETag is required"),
        PartNumber: z.number().int().positive("Part number must be positive"),
      }),
    )
    .min(1, "At least one part is required"),
});

export type AdmissionSettingsData = z.infer<typeof admissionSettingsSchema>;
export type AdmissionNoticeUploadData = z.infer<typeof admissionNoticeUploadSchema>;
export type AdmissionResultCreateData = z.infer<typeof admissionResultCreateSchema>;
export type AdmissionResultUpdateData = z.infer<typeof admissionResultUpdateSchema>;
export type AdmissionResultUploadRequestData = z.infer<
  typeof admissionResultUploadRequestSchema
>;
export type AdmissionResultMultipartSignData = z.infer<
  typeof admissionResultMultipartSignSchema
>;
export type AdmissionResultMultipartCompleteData = z.infer<
  typeof admissionResultMultipartCompleteSchema
>;
export type AdmissionPhotoUploadData = z.infer<typeof admissionPhotoUploadSchema>;

export const admissionSettingsDefaultValues: AdmissionSettingsData = {
  admission_year: new Date().getFullYear(),
  admission_open: false,
  instruction: "Please follow the instructions carefully",
  attachment_instruction_class6: "",
  attachment_instruction_class7: "",
  attachment_instruction_class8: "",
  attachment_instruction_class9: "",
  ingikar: "",
  class_list: "",
  list_type_class6: "",
  list_type_class7: "",
  list_type_class8: "",
  list_type_class9: "",
  user_id_class6: "",
  user_id_class7: "",
  user_id_class8: "",
  user_id_class9: "",
  serial_no_class6: "",
  serial_no_class7: "",
  serial_no_class8: "",
  serial_no_class9: "",
  notice_key: null,
};
