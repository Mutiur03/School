import React from "react";
import type { SubjectMark } from "@/queries/marks.queries";
import type { Subject } from "@/types/subjects";

interface Student {
  student_id: number;
  name: string;
  roll: number;
  section: string;
  group: string;
}

interface StudentMarkRowProps {
  student: Student;
  selectedSubject: Subject;
  studentSubject?: SubjectMark;
  onMarkChange: (studentId: number, subjectId: number, markType: string, value: string) => void;
}

const MarkInput: React.FC<{
  value: number | null | undefined;
  maxMark: number;
  label?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}> = ({ value, maxMark, label, disabled, onChange }) => {
  const displayValue = value === null || value === undefined ? "" : String(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === "") {
      onChange("");
      return;
    }
    const digitsOnly = raw.replace(/\D/g, "");
    if (digitsOnly === "") return;
    onChange(digitsOnly);
  };

  return (
    <div className="flex flex-col items-center gap-0.5">
      {label && <span className="text-[9px] text-muted-foreground font-medium uppercase sm:hidden">{label}</span>}
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={displayValue}
        onChange={handleChange}
        disabled={disabled}
        placeholder={disabled ? "—" : `/${maxMark}`}
        className={`w-14 sm:w-16 p-1.5 sm:p-2 border border-border rounded text-center text-xs sm:text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all ${
          disabled ? "bg-muted cursor-not-allowed text-muted-foreground" : "bg-card"
        }`}
      />
    </div>
  );
};

// Desktop table row
const TableRow: React.FC<StudentMarkRowProps> = ({
  student,
  selectedSubject,
  studentSubject,
  onMarkChange,
}) => {
  const isGroupMismatch = selectedSubject.group && selectedSubject.group !== "" && selectedSubject.group !== student.group;

  if (isGroupMismatch) {
    return (
      <tr className="bg-muted/30">
        <td className="px-2 sm:px-4 py-2 sm:py-3">
          <div className="text-xs sm:text-sm font-medium">{student.name}</div>
          <div className="text-[10px] text-muted-foreground">R:{student.roll} | S:{student.section || "–"}</div>
        </td>
        <td colSpan={3} className="px-2 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs text-muted-foreground italic">
          Not available for student group
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-2 sm:px-4 py-2 sm:py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-1 rounded-md tabular-nums">{student.roll}</span>
            <span className="text-[10px] font-semibold bg-muted px-1.5 py-1 rounded-md text-muted-foreground">{student.section || "–"}</span>
          </div>
          <span className="text-sm text-foreground/80 truncate">{student.name}</span>
        </div>
      </td>
      {selectedSubject.marking_scheme === "BREAKDOWN" ? (
        <>
          <td className="px-1 sm:px-4 py-2 sm:py-3 text-center">
            <MarkInput
              value={studentSubject?.cq_marks}
              maxMark={selectedSubject.cq_mark || 100}
              disabled={!selectedSubject.cq_mark}
              onChange={(v) => onMarkChange(student.student_id, selectedSubject.id, "cq_marks", v)}
            />
          </td>
          <td className="px-1 sm:px-4 py-2 sm:py-3 text-center">
            <MarkInput
              value={studentSubject?.mcq_marks}
              maxMark={selectedSubject.mcq_mark || 100}
              disabled={!selectedSubject.mcq_mark}
              onChange={(v) => onMarkChange(student.student_id, selectedSubject.id, "mcq_marks", v)}
            />
          </td>
          <td className="px-1 sm:px-4 py-2 sm:py-3 text-center">
            <MarkInput
              value={studentSubject?.practical_marks}
              maxMark={selectedSubject.practical_mark || 100}
              disabled={!selectedSubject.practical_mark}
              onChange={(v) => onMarkChange(student.student_id, selectedSubject.id, "practical_marks", v)}
            />
          </td>
        </>
      ) : (
        <td className="px-1 sm:px-4 py-2 sm:py-3 text-center">
          <MarkInput
            value={studentSubject?.marks}
            maxMark={selectedSubject.full_mark || 100}
            onChange={(v) => onMarkChange(student.student_id, selectedSubject.id, "marks", v)}
          />
        </td>
      )}
    </tr>
  );
};

// Mobile card row
const CardRow: React.FC<StudentMarkRowProps> = ({
  student,
  selectedSubject,
  studentSubject,
  onMarkChange,
}) => {
  const isGroupMismatch = selectedSubject.group && selectedSubject.group !== "" && selectedSubject.group !== student.group;

  if (isGroupMismatch) {
    return (
      <div className="flex items-center justify-between px-3 py-2.5 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground w-7 shrink-0">{student.roll}</span>
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{student.section || "–"}</span>
        </div>
        <span className="text-[10px] text-muted-foreground italic">N/A for group</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border hover:bg-muted/20 transition-colors">
      {/* Roll + Section identifier */}
      <div className="flex items-center gap-1.5 shrink-0 min-w-[52px]">
        <span className="text-xs font-bold tabular-nums w-6 text-right">{student.roll}</span>
        <span className="text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded font-medium">{student.section || "–"}</span>
      </div>

      {/* Mark inputs */}
      <div className="flex items-center gap-1.5 ml-auto">
        {selectedSubject.marking_scheme === "BREAKDOWN" ? (
          <>
            <MarkInput
              value={studentSubject?.cq_marks}
              maxMark={selectedSubject.cq_mark || 100}
              label="CQ"
              disabled={!selectedSubject.cq_mark}
              onChange={(v) => onMarkChange(student.student_id, selectedSubject.id, "cq_marks", v)}
            />
            <MarkInput
              value={studentSubject?.mcq_marks}
              maxMark={selectedSubject.mcq_mark || 100}
              label="MCQ"
              disabled={!selectedSubject.mcq_mark}
              onChange={(v) => onMarkChange(student.student_id, selectedSubject.id, "mcq_marks", v)}
            />
            <MarkInput
              value={studentSubject?.practical_marks}
              maxMark={selectedSubject.practical_mark || 100}
              label="Prac"
              disabled={!selectedSubject.practical_mark}
              onChange={(v) => onMarkChange(student.student_id, selectedSubject.id, "practical_marks", v)}
            />
          </>
        ) : (
          <MarkInput
            value={studentSubject?.marks}
            maxMark={selectedSubject.full_mark || 100}
            onChange={(v) => onMarkChange(student.student_id, selectedSubject.id, "marks", v)}
          />
        )}
      </div>
    </div>
  );
};

const StudentMarkRow: React.FC<StudentMarkRowProps & { variant?: "table" | "card" }> = ({ variant = "table", ...props }) => {
  return variant === "card" ? <CardRow {...props} /> : <TableRow {...props} />;
};

export default React.memo(StudentMarkRow);
