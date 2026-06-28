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

export type AdmissionSettingsData = z.infer<typeof admissionSettingsSchema>;
export type AdmissionNoticeUploadData = z.infer<typeof admissionNoticeUploadSchema>;

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
