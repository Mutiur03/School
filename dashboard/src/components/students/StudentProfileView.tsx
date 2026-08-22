import { format } from "date-fns";
import { getFileUrl } from "@/lib/backend";
import { Badge } from "@/components/ui/badge";
import type { Student } from "@/types/students";

export type StudentProfileData = Pick<
  Student,
  | "name"
  | "father_name"
  | "mother_name"
  | "father_phone"
  | "mother_phone"
  | "village"
  | "post_office"
  | "upazila"
  | "district"
  | "religion"
  | "dob"
  | "roll"
  | "section"
  | "class"
  | "group"
  | "has_stipend"
  | "available"
  | "image"
> & {
  login_id: number | string;
};

interface InfoRowProps {
  label: string;
  value?: string | null;
}

function InfoRow({ label, value }: InfoRowProps) {
  if (!value) return null;
  return (
    <div className="flex gap-3 text-sm py-2 border-b border-border/60 last:border-0">
      <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

interface StudentProfileViewProps {
  student: StudentProfileData;
  compact?: boolean;
}

export function StudentProfileView({ student, compact = false }: StudentProfileViewProps) {
  const addressParts = [
    student.village,
    student.post_office,
    student.upazila,
    student.district,
  ].filter(Boolean);

  const dobLabel =
    student.dob
      ? format(new Date(student.dob), "dd MMM yyyy")
      : null;

  return (
    <div className="space-y-5">
      <div
        className={`flex ${compact ? "flex-col items-center text-center" : "flex-col sm:flex-row sm:items-start gap-5"} rounded-xl border border-border bg-muted/30 p-5`}
      >
        {student.image ? (
          <img
            src={getFileUrl(student.image)}
            alt={student.name}
            className={`${compact ? "w-24" : "w-28"} aspect-[7/9] object-cover rounded-md border border-border shadow-sm shrink-0`}
          />
        ) : (
          <div
            className={`${compact ? "w-24" : "w-28"} aspect-[7/9] rounded-md border border-border bg-muted flex items-center justify-center text-3xl font-bold text-muted-foreground shrink-0`}
          >
            {student.name.charAt(0).toUpperCase()}
          </div>
        )}

        <div className={`flex-1 ${compact ? "mt-3" : ""}`}>
          <h2 className="text-xl font-semibold tracking-tight">{student.name}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Login ID {student.login_id}
          </p>

          <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
            <Badge variant="secondary">Class {student.class}</Badge>
            <Badge variant="secondary">Section {student.section}</Badge>
            <Badge variant="secondary">Roll {student.roll}</Badge>
            {student.group ? (
              <Badge variant="outline">{student.group}</Badge>
            ) : null}
            {student.has_stipend ? (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200/60">
                Stipend
              </Badge>
            ) : null}
            {!student.available ? (
              <Badge variant="destructive">Inactive</Badge>
            ) : (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200/60">
                Active
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className={`grid gap-4 ${compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}>
        <section className="rounded-lg border border-border p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Personal
          </h3>
          <InfoRow label="Date of birth" value={dobLabel} />
          <InfoRow label="Religion" value={student.religion || "N/A"} />
          <InfoRow label="Father's name" value={student.father_name} />
          <InfoRow label="Mother's name" value={student.mother_name} />
        </section>

        <section className="rounded-lg border border-border p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Contact
          </h3>
          <InfoRow label="Father's phone" value={student.father_phone || "N/A"} />
          <InfoRow label="Mother's phone" value={student.mother_phone || "N/A"} />
        </section>

        {addressParts.length > 0 ? (
          <section className={`rounded-lg border border-border p-4 ${compact ? "" : "md:col-span-2"}`}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Address
            </h3>
            <InfoRow label="Village" value={student.village} />
            <InfoRow label="Post office" value={student.post_office} />
            <InfoRow label="Upazila" value={student.upazila} />
            <InfoRow label="District" value={student.district} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
