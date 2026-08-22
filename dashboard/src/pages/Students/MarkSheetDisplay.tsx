import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, BookOpen, Award } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { SectionCard, StatsCard } from '@/components';
import { openBlobInNewTab } from '@school/common-ui/blob';

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
  if (value === null || value === undefined) return '—';
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
    const totalMarks = sortedMarks.reduce((sum, row) => sum + (row.marks ?? 0), 0);
    return {
      subjects: sortedMarks.length,
      totalMarks,
    };
  }, [sortedMarks]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await axios.get(`/api/marks/${studentId}/${year}/${examName}/download`, {
        responseType: 'blob',
      });
      const file = new Blob([response.data], { type: 'application/pdf' });
      openBlobInNewTab(file);
      toast.success('Marksheet opened in a new tab');
    } catch {
      toast.error('Could not download marksheet. Try again in a moment.');
    } finally {
      setDownloading(false);
    }
  };

  if (!marks || marks.length === 0) {
    return (
      <SectionCard className="border-dashed">
        <div className="px-6 py-14 text-center">
          <div className="bg-muted mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <FileText className="text-muted-foreground h-6 w-6" />
          </div>
          <p className="font-medium">No marks for this exam yet</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            Marks may not be published yet, or your teacher has not entered them. Check back later
            or ask your class teacher.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-5">
      <section className="border-border bg-muted/30 rounded-2xl border p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-primary text-sm font-medium">Exam result</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{examName}</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Session {year}
              {studentName ? ` · ${studentName}` : ''}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {classLevel !== undefined ? (
                <Badge variant="secondary">Class {classLevel}</Badge>
              ) : null}
              {roll !== undefined ? <Badge variant="secondary">Roll {roll}</Badge> : null}
            </div>
          </div>
          <Button onClick={handleDownload} disabled={downloading} className="shrink-0 gap-2">
            <Download className="h-4 w-4" />
            {downloading ? 'Opening PDF…' : 'Download marksheet'}
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
        icon={<FileText className="text-primary h-5 w-5" />}
        description="Marks recorded for each subject in this exam."
        noPadding
      >
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-muted/40 border-border border-b">
                <th className="text-foreground px-5 py-3.5 font-semibold">Subject</th>
                <th className="text-foreground w-32 px-5 py-3.5 text-center font-semibold">
                  Marks
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {sortedMarks.map((entry) => (
                <tr key={entry.subject} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3.5 font-medium">{entry.subject}</td>
                  <td className="text-primary px-5 py-3.5 text-center font-semibold tabular-nums">
                    {formatMark(entry.marks)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/20 border-border border-t font-semibold">
                <td className="px-5 py-3.5">Total</td>
                <td className="text-primary px-5 py-3.5 text-center tabular-nums">
                  {stats.totalMarks}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <ul className="divide-border divide-y md:hidden">
          {sortedMarks.map((entry) => (
            <li key={entry.subject} className="flex items-center justify-between gap-3 px-4 py-3.5">
              <span className="text-sm font-medium">{entry.subject}</span>
              <span className="text-primary font-semibold tabular-nums">
                {formatMark(entry.marks)}
              </span>
            </li>
          ))}
          <li className="bg-muted/30 flex items-center justify-between gap-3 px-4 py-3.5 font-semibold">
            <span>Total</span>
            <span className="text-primary tabular-nums">{stats.totalMarks}</span>
          </li>
        </ul>
      </SectionCard>
    </div>
  );
};

export default MarkSheetDisplay;
