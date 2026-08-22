import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, BookOpen, Award } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import { SectionCard, StatsCard } from "@/components";
import { openBlobInNewTab } from "@school/common-ui/blob";

export interface MarksheetRow {
  subject: string;
  marks: number | null;
}

interface MarkSheetDisplayProps {
  studentId: number;
  year: number;
  marks: MarksheetRow[];
  examName: string;
  roll?: number | string;
  class?: number | string;
  studentName?: string;
}

function formatMark(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return value;
}

const MarkSheetDisplay: React.FC<MarkSheetDisplayProps> = ({
  studentId,
  year,
  marks,
  examName,
  roll,
  class: classLevel,
  studentName,
}) => {
  const [downloading, setDownloading] = useState(false);

  const sortedMarks = useMemo(
    () => [...marks].sort((a, b) => a.subject.localeCompare(b.subject)),
    [marks],
  );

  const stats = useMemo(() => {
    const totalMarks = sortedMarks.reduce(
      (sum, row) => sum + (row.marks ?? 0),
      0,
    );
    return {
      subjects: sortedMarks.length,
      totalMarks,
    };
  }, [sortedMarks]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await axios.get(
        `/api/marks/${studentId}/${year}/${examName}/download`,
        { responseType: "blob" },
      );
      const file = new Blob([response.data], { type: "application/pdf" });
      openBlobInNewTab(file);
      toast.success("Marksheet opened in a new tab");
    } catch {
      toast.error("Could not download marksheet. Try again in a moment.");
    } finally {
      setDownloading(false);
    }
  };

  if (!marks || marks.length === 0) {
    return (
      <SectionCard className="border-dashed">
        <div className="py-14 px-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium">No marks for this exam yet</p>
          <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
            Marks may not be published yet, or your teacher has not entered them.
            Check back later or ask your class teacher.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-5">
      <section
        className="rounded-2xl border border-border bg-muted/30 p-5 sm:p-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Exam result</p>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight mt-1">
              {examName}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Session {year}
              {studentName ? ` · ${studentName}` : ""}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {classLevel !== undefined ? (
                <Badge variant="secondary">Class {classLevel}</Badge>
              ) : null}
              {roll !== undefined ? (
                <Badge variant="secondary">Roll {roll}</Badge>
              ) : null}
            </div>
          </div>
          <Button
            onClick={handleDownload}
            disabled={downloading}
            className="gap-2 shrink-0"
          >
            <Download className="h-4 w-4" />
            {downloading ? "Opening PDF…" : "Download marksheet"}
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <StatsCard
          label="Subjects"
          value={stats.subjects}
          color="blue"
          icon={<BookOpen className="h-4 w-4" />}
          loading={false}
        />
        <StatsCard
          label="Total marks"
          value={stats.totalMarks}
          color="emerald"
          icon={<Award className="h-4 w-4" />}
          loading={false}
        />
      </div>

      <SectionCard
        title="Subject marks"
        icon={<FileText className="h-5 w-5 text-primary" />}
        description="Marks recorded for each subject in this exam."
        noPadding
      >
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="px-5 py-3.5 font-semibold text-foreground">
                  Subject
                </th>
                <th className="px-5 py-3.5 text-center font-semibold text-foreground w-32">
                  Marks
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedMarks.map((entry) => (
                <tr
                  key={entry.subject}
                  className="hover:bg-muted/30 transition-colors"
                >
                  <td className="px-5 py-3.5 font-medium">{entry.subject}</td>
                  <td className="px-5 py-3.5 text-center tabular-nums font-semibold text-primary">
                    {formatMark(entry.marks)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/20 border-t border-border font-semibold">
                <td className="px-5 py-3.5">Total</td>
                <td className="px-5 py-3.5 text-center tabular-nums text-primary">
                  {stats.totalMarks}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <ul className="md:hidden divide-y divide-border">
          {sortedMarks.map((entry) => (
            <li
              key={entry.subject}
              className="flex items-center justify-between gap-3 px-4 py-3.5"
            >
              <span className="font-medium text-sm">{entry.subject}</span>
              <span className="tabular-nums font-semibold text-primary">
                {formatMark(entry.marks)}
              </span>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 px-4 py-3.5 bg-muted/30 font-semibold">
            <span>Total</span>
            <span className="tabular-nums text-primary">{stats.totalMarks}</span>
          </li>
        </ul>
      </SectionCard>
    </div>
  );
};

export default MarkSheetDisplay;
