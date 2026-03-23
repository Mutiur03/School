import React from "react";
import type { Student, SubjectMark } from "@/queries/marks.queries";
import type { Subject } from "@/types/subjects";

interface StudentMarkRowProps {
  student: Student;
  selectedSubject: Subject;
  studentSubject?: SubjectMark;
  onMarkChange: (studentId: number, subjectId: number, markType: string, value: string) => void;
}

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

  return selectedSubject.marking_scheme === "BREAKDOWN" ? (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-4 py-4">
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{student.name}</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded">Roll: {student.roll}</span>
            <span className="text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded">Sec: {student.section || "N/A"}</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-center">
        <input
          type="number"
          min="0"
          max={selectedSubject.cq_mark || 100}
          value={studentSubject?.cq_marks || 0}
          onChange={(e) => onMarkChange(student.student_id, selectedSubject.id, "cq_marks", e.target.value)}
          disabled={!selectedSubject.cq_mark}
          className={`w-16 p-2 border border-border rounded text-center text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all ${!selectedSubject.cq_mark ? "bg-muted cursor-not-allowed text-muted-foreground" : "bg-card"
            }`}
        />
      </td>
      <td className="px-4 py-4 text-center">
        <input
          type="number"
          min="0"
          max={selectedSubject.mcq_mark || 100}
          value={studentSubject?.mcq_marks || 0}
          onChange={(e) => onMarkChange(student.student_id, selectedSubject.id, "mcq_marks", e.target.value)}
          disabled={!selectedSubject.mcq_mark}
          className={`w-16 p-2 border border-border rounded text-center text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all ${!selectedSubject.mcq_mark ? "bg-muted cursor-not-allowed text-muted-foreground" : "bg-card"
            }`}
        />
      </td>
      <td className="px-4 py-4 text-center">
        <input
          type="number"
          min="0"
          max={selectedSubject.practical_mark || 100}
          value={studentSubject?.practical_marks || 0}
          onChange={(e) => onMarkChange(student.student_id, selectedSubject.id, "practical_marks", e.target.value)}
          disabled={!selectedSubject.practical_mark}
          className={`w-16 p-2 border border-border rounded text-center text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all ${!selectedSubject.practical_mark ? "bg-muted cursor-not-allowed text-muted-foreground" : "bg-card"
            }`}
        />
      </td>
    </tr>
  ) : (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-4 py-4">
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{student.name}</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded">Roll: {student.roll}</span>
            <span className="text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded">Sec: {student.section || "N/A"}</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-center">
        <input
          type="number"
          min="0"
          max={selectedSubject.full_mark || 100}
          value={studentSubject?.marks || 0}
          onChange={(e) => onMarkChange(student.student_id, selectedSubject.id, "marks", e.target.value)}
          className="w-16 p-2 border border-border rounded text-center text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all bg-card"
        />
      </td>
    </tr>
  );
};

export default React.memo(StudentMarkRow);
