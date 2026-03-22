export interface Subject {
  id: number;
  name: string;
  class: number;
  full_mark: number;
  pass_mark: number;
  cq_mark?: number;
  mcq_mark?: number;
  practical_mark?: number;
  cq_pass_mark?: number;
  mcq_pass_mark?: number;
  practical_pass_mark?: number;
  group: string;
  year: number;
  subject_type: "main" | "paper" | "single";
  parent_id?: number | null;
  assessment_type: "exam" | "continuous";
  marking_scheme: "TOTAL" | "BREAKDOWN";
  priority: number;
  created_at: string;
}
