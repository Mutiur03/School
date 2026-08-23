import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Loading, PageHeader, SectionCard } from '@/components';
import { Button } from '@/components/ui/button';
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
}

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
      alert('Failed to download PDF. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  };

  const examNames =
    marksheet && marksheet.length > 0 && marksheet[0]?.exam_marks
      ? Object.keys(marksheet[0].exam_marks)
      : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Academic Marksheet"
        description="Preview student marks and download the official PDF."
      >
        {marksheet && marksheet.length > 0 && (
          <Button onClick={handleDownloadPDF} disabled={pdfLoading}>
            {pdfLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {pdfLoading ? 'Downloading...' : 'Download PDF'}
          </Button>
        )}
      </PageHeader>

      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center">
          <Loading />
        </div>
      ) : error ? (
        <div className="bg-destructive/10 border-destructive/20 rounded-lg border p-4">
          <p className="text-destructive text-center">{error}</p>
        </div>
      ) : marksheet && marksheet.length > 0 ? (
        <SectionCard icon={<FileSpreadsheet size={20} />}>
          <div className="mb-6 text-center">
            <h2 className="text-primary text-xl font-bold sm:text-2xl">
              Panchbibi Lal Bihari Pilot Govt. High School
            </h2>
            <h3 className="text-muted-foreground text-sm">Panchbibi, Joypurhat</h3>
            <div className="border-border my-4 border-t" />
            <p className="text-lg font-semibold">Academic Marksheet</p>
          </div>

          <div className="bg-muted/40 mb-6 grid grid-cols-1 gap-4 rounded-lg p-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="font-medium">
                <span className="text-muted-foreground">Name:</span>{' '}
                <span className="text-foreground">{marksheet[0]?.student_name || 'N/A'}</span>
              </p>
              <p className="font-medium">
                <span className="text-muted-foreground">Roll:</span>{' '}
                <span className="text-foreground">{marksheet[0]?.roll || 'N/A'}</span>
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-medium">
                <span className="text-muted-foreground">Class:</span>{' '}
                <span className="text-foreground">{marksheet[0]?.class || 'N/A'}</span>
              </p>
              <p className="font-medium">
                <span className="text-muted-foreground">Section:</span>{' '}
                <span className="text-foreground">{marksheet[0]?.section || 'N/A'}</span>
              </p>
              <p className="font-medium">
                <span className="text-muted-foreground">Year:</span>{' '}
                <span className="text-foreground">{marksheet[0]?.year || 'N/A'}</span>
              </p>
            </div>
          </div>

          {marksheet[0]?.final_merit && (
            <div className="mb-6 text-center">
              <span className="bg-primary/10 text-primary inline-block rounded-full px-4 py-2 font-semibold">
                Merit Position: {marksheet[0].final_merit}
              </span>
            </div>
          )}

          {/* Desktop / print-friendly table */}
          <div className="hidden max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] lg:block print:block">
            <table className="border-input w-full min-w-[320px] border-collapse rounded-lg border">
              <thead className="bg-popover border-b border-gray-400">
                <tr className="bg-popover">
                  <th className="bg-popover sticky left-0 z-20 border-r px-3 py-3 text-center font-semibold shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] sm:px-4">
                    Subject
                  </th>
                  {examNames.map((exam) => (
                    <th key={exam} className="px-4 py-3 text-center font-semibold">
                      {exam}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-400">
                {marksheet.map((entry, index) => (
                  <tr key={index}>
                    <td className="bg-card sticky left-0 z-10 border-r px-3 py-3 font-medium shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] sm:px-4">
                      {entry.subject}
                    </td>
                    {Object.keys(entry.exam_marks || {}).map((exam, idx) => (
                      <td key={idx} className="px-4 py-3 text-center">
                        {entry.exam_marks[exam]}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-muted/50 text-center font-semibold dark:bg-slate-800">
                  <td className="bg-muted/50 sticky left-0 z-10 border-r px-3 py-3 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] sm:px-4 dark:bg-slate-800">
                    Total
                  </td>
                  {marksheet[0]?.total_marks_per_exam &&
                    Object.keys(marksheet[0].total_marks_per_exam).map((exam) => (
                      <td key={exam} className="px-4 py-3 text-center">
                        {marksheet[0].total_marks_per_exam?.[exam]}
                      </td>
                    ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Mobile stacked view — screen only, does not affect print layout */}
          <div className="space-y-3 lg:hidden print:hidden">
            {marksheet.map((entry, index) => (
              <div key={index} className="bg-muted/40 space-y-2 rounded-lg border p-3">
                <p className="font-semibold">{entry.subject}</p>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(entry.exam_marks || {}).map(([exam, marks]) => (
                    <div key={exam}>
                      <dt className="text-muted-foreground text-xs">{exam}</dt>
                      <dd className="font-medium tabular-nums">{marks}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
            {marksheet[0]?.total_marks_per_exam && (
              <div className="bg-muted/40 space-y-2 rounded-lg border p-3 font-semibold">
                <p>Total</p>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(marksheet[0].total_marks_per_exam).map(([exam, marks]) => (
                    <div key={exam}>
                      <dt className="text-muted-foreground text-xs font-normal">{exam}</dt>
                      <dd className="tabular-nums">{marks}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>

          <div className="border-border mt-8 flex justify-end border-t pt-4 lg:hidden print:hidden">
            <Button onClick={handleDownloadPDF} disabled={pdfLoading}>
              {pdfLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {pdfLoading ? 'Downloading...' : 'Download as PDF'}
            </Button>
          </div>
        </SectionCard>
      ) : (
        <SectionCard>
          <p className="text-muted-foreground text-center">No marksheet data available.</p>
        </SectionCard>
      )}
    </div>
  );
}

export default ShowMarkSheet;
