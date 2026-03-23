import React from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import axios from "axios";
import { SectionCard } from "@/components";

interface MarksheetEntry {
  name: string;
  roll: string;
  class: string;
  subject: string;
  marks: number | null;
  cq_marks?: number | null;
  mcq_marks?: number | null;
  practical_marks?: number | null;
  subject_info?: {
    full_mark?: number;
    cq_mark?: number;
    mcq_mark?: number;
    practical_mark?: number;
  };
}

interface MarkSheetDisplayProps {
  studentId: number;
  year: number;
  marks: MarksheetEntry[];
  examName: string;
}

const MarkSheetDisplay: React.FC<MarkSheetDisplayProps> = ({
  studentId,
  year,
  marks,
  examName,
}) => {
  if (!marks || marks.length === 0) {
    return (
      <SectionCard className="mt-6 border-dashed text-center py-12 text-muted-foreground">
        No marksheet data available for this selection.
      </SectionCard>
    );
  }

  const exams = [examName];

  const handleDownload = async () => {
    try {
      const downloadUrl = `/api/marks/${studentId}/${year}/${examName}/download`;
      const response = await axios.get(downloadUrl, {
        responseType: "blob",
      });
      const file = new Blob([response.data], { type: "application/pdf" });
      const url = URL.createObjectURL(file);
      window.open(url, "_blank");
    } catch (error) {
      console.error("Open PDF failed", error);
    }
  };

  return (
    <SectionCard
      title="Academic Transcript"
      icon={<FileText className="w-5 h-5" />}
      description={`Session: ${year} | Roll: ${marks[0].roll} | Class: ${marks[0].class}`}
      headerAction={
        <Button onClick={handleDownload} variant="outline" className="gap-2 shadow-sm font-semibold">
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
      }
      noPadding
      className="mt-6"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100 italic">Subject</th>
              {exams.map((exam) => (
                <th key={exam} className="px-6 py-4 text-center font-bold text-gray-900 dark:text-gray-100">
                  {exam}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {marks
              .filter((entry) => entry.marks !== null)
              .map((entry, index) => (
              <tr key={index} className="hover:bg-muted/30 transition-all group">
                <td className="px-6 py-4 font-bold text-gray-800 dark:text-gray-200 group-hover:text-primary transition-colors uppercase">
                  {entry.subject}
                </td>
                {exams.map((exam) => (
                  <td key={exam} className="px-6 py-4 text-center tabular-nums">
                    {entry.marks ?? "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
};

export default MarkSheetDisplay;
