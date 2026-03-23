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
  disabled?: boolean;
  onChange: (value: string) => void;
}> = ({ value, maxMark, disabled, onChange }) => {
  const displayValue = value === null || value === undefined ? "" : String(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow empty string (clearing the field)
    if (raw === "") {
      onChange("");
      return;
    }
    // Strip non-digit characters
    const digitsOnly = raw.replace(/\D/g, "");
    if (digitsOnly === "") return;
    onChange(digitsOnly);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={displayValue}
      onChange={handleChange}
      disabled={disabled}
      placeholder={disabled ? "—" : `/${maxMark}`}
      className={`w-16 p-2 border border-border rounded text-center text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all ${
        disabled ? "bg-muted cursor-not-allowed text-muted-foreground" : "bg-card"
      }`}
    />
  );
};

const StudentMarkRow: React.FC<StudentMarkRowProps> = ({
  student,
  selectedSubject,
  studentSubject,
  onMarkChange,
}) => {
  const studentGroup = student.group;
  const subjectGroup = selectedSubject.group;
  const isGroupMismatch = subjectGroup && subjectGroup !== "" && subjectGroup !== studentGroup;

  if (isGroupMismatch) {
    return (
      <tr className="bg-muted/30">
        <td className="px-4 py-4">
          <div className="text-sm font-medium">{student.name}</div>
          <div className="text-[10px] text-muted-foreground">Roll: {student.roll} | Sec: {student.section || "N/A"}</div>
        </td>
        <td colSpan={3} className="px-4 py-4 text-center text-xs text-muted-foreground italic">
          Not available for student group
        </td>
      </tr>
    );
  }

  const studentInfo = (
    <td className="px-4 py-4">
      <div className="flex flex-col">
        <span className="text-sm font-semibold">{student.name}</span>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded">Roll: {student.roll}</span>
          <span className="text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded">Sec: {student.section || "N/A"}</span>
        </div>
      </div>
    </td>
  );

  return selectedSubject.marking_scheme === "BREAKDOWN" ? (
    <tr className="hover:bg-muted/30 transition-colors">
      {studentInfo}
      <td className="px-4 py-4 text-center">
        <MarkInput
          value={studentSubject?.cq_marks}
          maxMark={selectedSubject.cq_mark || 100}
          disabled={!selectedSubject.cq_mark}
          onChange={(v) => onMarkChange(student.student_id, selectedSubject.id, "cq_marks", v)}
        />
      </td>
      <td className="px-4 py-4 text-center">
        <MarkInput
          value={studentSubject?.mcq_marks}
          maxMark={selectedSubject.mcq_mark || 100}
          disabled={!selectedSubject.mcq_mark}
          onChange={(v) => onMarkChange(student.student_id, selectedSubject.id, "mcq_marks", v)}
        />
      </td>
      <td className="px-4 py-4 text-center">
        <MarkInput
          value={studentSubject?.practical_marks}
          maxMark={selectedSubject.practical_mark || 100}
          disabled={!selectedSubject.practical_mark}
          onChange={(v) => onMarkChange(student.student_id, selectedSubject.id, "practical_marks", v)}
        />
      </td>
    </tr>
  ) : (
    <tr className="hover:bg-muted/30 transition-colors">
      {studentInfo}
      <td className="px-4 py-4 text-center">
        <MarkInput
          value={studentSubject?.marks}
          maxMark={selectedSubject.full_mark || 100}
          onChange={(v) => onMarkChange(student.student_id, selectedSubject.id, "marks", v)}
        />
      </td>
    </tr>
  );
};

export default React.memo(StudentMarkRow);
