import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Download, Loader2 } from 'lucide-react';
import { SectionCard } from '@/components';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { blobErrorMessage, openBlobInNewTab } from '@school/common-ui/blob';

interface SessionRow {
  subject: string;
  /** split: [previous, year-end, total]; class 10: [year-end]. */
  marks: string[];
  fullMark: string;
  passMark: string;
  grade: string;
  gp: string;
}

interface SessionMarksheet {
  student: { name: string; class: number; section: string; roll: number; year: number };
  previous_exam_name: string | null;
  year_end_exam_name: string;
  split: boolean;
  examRows: SessionRow[];
  continuousRows: SessionRow[];
  totals: string[];
  grand_total: number;
  gpa: number;
  is_failed: boolean;
  fail_count: number;
  position: number;
}

// Pinned Subject column; opaque background hides the exam columns scrolling under it.
const stickySubject =
  'sticky left-0 z-[1] min-w-[9rem] bg-inherit shadow-[1px_0_0_var(--border)] sm:min-w-[12rem]';
const yearEndTint = 'bg-[color-mix(in_oklab,var(--primary)_5%,var(--card))]';

const Mark = ({ value }: { value: string }) =>
  value === '-' ? (
    <span className="text-muted-foreground" aria-label="Not entered">
      —
    </span>
  ) : (
    <>{value}</>
  );

const cellClass = 'px-3 py-2 text-center text-sm tabular-nums';

function ShowMarkSheet() {
  const { studentId, year } = useParams<{ studentId: string; year: string }>();
  const [sheet, setSheet] = useState<SessionMarksheet | null>(null);
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
        setSheet(response.data?.data ?? null);
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
    } catch (error) {
      toast.error(await blobErrorMessage(error, 'Failed to download PDF. Please try again.'));
    } finally {
      setPdfLoading(false);
    }
  };

  const hasData = Boolean(sheet && sheet.examRows.length > 0);
  const markHeads = sheet
    ? sheet.split
      ? [sheet.previous_exam_name ?? 'Previous exam', sheet.year_end_exam_name, 'Total']
      : [sheet.year_end_exam_name]
    : [];

  const summary = loading
    ? 'Loading…'
    : sheet
      ? [
          sheet.student.name || 'Unnamed student',
          `Class ${sheet.student.class}${sheet.student.section ? ` ${sheet.student.section}` : ''}`,
          `Roll ${sheet.student.roll}`,
          `Session ${sheet.student.year || year}`,
          sheet.position ? `Position ${sheet.position}` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : 'Preview the student’s session result and download the official PDF.';

  const rowCells = (row: SessionRow) => [
    ...row.marks,
    row.fullMark,
    row.passMark,
    row.grade,
    row.gp,
  ];

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
        ) : !hasData || !sheet ? (
          <p className="text-muted-foreground px-4 py-12 text-center text-sm">
            No marksheet data available.
          </p>
        ) : (
          // One table for every screen: narrow screens scroll the mark columns sideways.
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full border-collapse text-left">
              <thead className="text-foreground/70 [&_th]:bg-muted text-xs font-semibold uppercase tracking-wider">
                <tr className="border-border border-b">
                  <th rowSpan={2} className={cn(stickySubject, 'px-3 py-2.5')}>
                    Subject
                  </th>
                  <th colSpan={markHeads.length} className="px-3 py-2 text-center">
                    Obtained marks
                  </th>
                  {['Full', 'Pass', 'Grade', 'GP'].map((h) => (
                    <th key={h} rowSpan={2} className="px-3 py-2.5 text-center">
                      {h}
                    </th>
                  ))}
                </tr>
                <tr className="border-border border-b">
                  {markHeads.map((h) => (
                    <th
                      key={h}
                      className={cn(
                        'min-w-24 whitespace-nowrap px-3 py-2 text-center normal-case tracking-normal',
                        h === sheet.year_end_exam_name && 'text-primary',
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {sheet.examRows.map((row) => (
                  <tr key={row.subject} className="bg-card">
                    <td className={cn(stickySubject, 'px-3 py-2 text-sm font-medium')}>
                      {row.subject}
                    </td>
                    {rowCells(row).map((value, i) => (
                      <td
                        key={i}
                        className={cn(
                          cellClass,
                          markHeads[i] === sheet.year_end_exam_name && yearEndTint,
                        )}
                      >
                        <Mark value={value} />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))] font-semibold">
                  <td className={cn(stickySubject, 'px-3 py-2.5 text-sm')}>Total</td>
                  {sheet.totals.map((value, i) => (
                    <td key={i} className={cellClass}>
                      {value}
                    </td>
                  ))}
                  <td colSpan={4} />
                </tr>
                {sheet.continuousRows.length > 0 && (
                  <tr className="bg-card">
                    <td
                      colSpan={markHeads.length + 5}
                      className="text-muted-foreground px-3 py-2 text-xs font-semibold uppercase tracking-wider"
                    >
                      Continuous assessment
                    </td>
                  </tr>
                )}
                {sheet.continuousRows.map((row) => (
                  <tr key={row.subject} className="bg-card">
                    <td className={cn(stickySubject, 'px-3 py-2 text-sm font-medium')}>
                      {row.subject}
                    </td>
                    {rowCells(row).map((value, i) => (
                      <td key={i} className={cellClass}>
                        <Mark value={value} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="border-border grid grid-cols-2 gap-x-6 gap-y-2 border-t p-4 text-sm tabular-nums sm:grid-cols-5">
              {[
                ['Grand total', String(sheet.grand_total)],
                ['GPA', sheet.gpa.toFixed(2)],
                ['Result', sheet.is_failed ? 'Failed' : 'Passed'],
                ['Failed subjects', String(sheet.fail_count)],
                ['Position', sheet.position ? String(sheet.position) : '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground text-xs">{label}</dt>
                  <dd
                    className={cn(
                      'font-semibold',
                      label === 'Result' && sheet.is_failed && 'text-destructive',
                    )}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export default ShowMarkSheet;
