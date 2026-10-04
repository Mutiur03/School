import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Download, Loader2 } from 'lucide-react';
import { SectionCard } from '@/components';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { openBlobInNewTab } from '@school/common-ui/blob';

interface ExamMarks {
  [examName: string]: number;
}

interface MarksheetEntry {
  student_name: string;
  roll: string;
  class: string;
  section: string;
  year: string;
  subject: string;
  exam_marks: ExamMarks;
  total_marks_per_exam?: ExamMarks;
  final_merit?: number;
  year_end_exam_name?: string | null;
}

// Pinned Subject column; opaque background hides the exam columns scrolling under it.
const stickySubject =
  'sticky left-0 z-[1] min-w-[9rem] bg-inherit shadow-[1px_0_0_var(--border)] sm:min-w-[12rem]';
const yearEndTint = 'bg-[color-mix(in_oklab,var(--primary)_5%,var(--card))]';

const Mark = ({ value }: { value: number | undefined | null }) =>
  value === undefined || value === null ? (
    <span className="text-muted-foreground" aria-label="Not entered">
      —
    </span>
  ) : (
    <>{value}</>
  );

function ShowMarkSheet() {
  const { studentId, year } = useParams<{ studentId: string; year: string }>();
  const [marksheet, setMarksheet] = useState<MarksheetEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMarkSheet = async () => {
      if (!studentId || !year) {
        setError('Invalid student ID or year.');
        setLoading(false);
        return;
      }
      try {
        const response = await axios.get(`/api/marks/${studentId}/${year}/preview`);
        if (response.status !== 200) throw new Error('Failed to fetch marksheet.');
        setMarksheet(response.data);
      } catch {
        setError('Marks sheet not found. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchMarkSheet();
  }, [studentId, year]);

  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      const response = await axios.get(`/api/marks/${studentId}/${year}/download`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      openBlobInNewTab(blob);
    } catch {
      toast.error('Failed to download PDF. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  };

  const first = marksheet?.[0];
  const examNames = first?.exam_marks ? Object.keys(first.exam_marks) : [];
  const yearEndExamName = first?.year_end_exam_name ?? null;
  const hasData = Boolean(marksheet && marksheet.length > 0);

  const summary = loading
    ? 'Loading…'
    : first
      ? [
          first.student_name || 'Unnamed student',
          `Class ${first.class || '—'}${first.section ? ` ${first.section}` : ''}`,
          `Roll ${first.roll || '—'}`,
          `Session ${first.year || year}`,
          first.final_merit ? `Merit position ${first.final_merit}` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : 'Preview the student’s yearly marks and download the official PDF.';

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Marksheet</h1>
          <p className="text-muted-foreground mt-1 text-sm tabular-nums">{summary}</p>
        </div>
        {hasData && (
          <Button type="button" onClick={handleDownloadPDF} disabled={pdfLoading}>
            {pdfLoading ? <Loader2 className="animate-spin" /> : <Download />}
            {pdfLoading ? 'Downloading…' : 'Download PDF'}
          </Button>
        )}
      </header>

      <SectionCard noPadding className="mb-6">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="text-destructive px-4 py-12 text-center text-sm">{error}</p>
        ) : !hasData || !marksheet ? (
          <p className="text-muted-foreground px-4 py-12 text-center text-sm">
            No marksheet data available.
          </p>
        ) : (
          // One table for every screen: narrow screens scroll the exam columns sideways.
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-border [&>th]:bg-muted text-foreground/70 border-b text-xs font-semibold uppercase tracking-wider [&>th:first-child]:rounded-tl-[calc(var(--radius)+3px)] [&>th:last-child]:rounded-tr-[calc(var(--radius)+3px)]">
                  <th className={cn(stickySubject, 'px-3 py-2.5')}>Subject</th>
                  {examNames.map((exam) => (
                    <th
                      key={exam}
                      className={cn(
                        'min-w-24 whitespace-nowrap px-3 py-2.5 text-center normal-case tracking-normal',
                        exam === yearEndExamName && 'text-primary',
                      )}
                    >
                      {exam}
                      {exam === yearEndExamName && (
                        <span className="block text-[10px] font-medium uppercase tracking-wider">
                          Year end
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {marksheet.map((entry) => (
                  <tr key={entry.subject} className="bg-card">
                    <td className={cn(stickySubject, 'px-3 py-2 text-sm font-medium')}>
                      {entry.subject}
                    </td>
                    {examNames.map((exam) => (
                      <td
                        key={exam}
                        className={cn(
                          'px-3 py-2 text-center text-sm tabular-nums',
                          exam === yearEndExamName && yearEndTint,
                        )}
                      >
                        <Mark value={entry.exam_marks?.[exam]} />
                      </td>
                    ))}
                  </tr>
                ))}
                {first?.total_marks_per_exam && (
                  <tr className="bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))] font-semibold">
                    <td className={cn(stickySubject, 'px-3 py-2.5 text-sm')}>Total</td>
                    {examNames.map((exam) => (
                      <td key={exam} className="px-3 py-2.5 text-center text-sm tabular-nums">
                        <Mark value={first.total_marks_per_exam?.[exam]} />
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export default ShowMarkSheet;
