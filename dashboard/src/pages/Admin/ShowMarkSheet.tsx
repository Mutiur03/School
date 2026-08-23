import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import Loading from '@/components/Loading';
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

  return (
    <div className="font-outfit mx-auto max-w-4xl p-4">
      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center">
          <Loading />
        </div>
      ) : error ? (
        <div className="bg-destructive/10 border-destructive/20 rounded-lg border p-4">
          <p className="text-destructive text-center">{error}</p>
        </div>
      ) : marksheet && marksheet.length > 0 ? (
        <div className="bg-card text-card-foreground border-border rounded-lg border p-6 shadow-lg">
          <div className="mb-6 text-center">
            <h1 className="text-primary text-2xl font-bold">
              Panchbibi Lal Bihari Pilot Govt. High School
            </h1>
            <h3 className="text-muted-foreground">Panchbibi, Joypurhat</h3>
            <div className="border-border my-4 border-t"></div>
            <h2 className="text-xl font-semibold">Academic Marksheet</h2>
          </div>

          {/* Student Info */}
          <div className="mb-6 grid grid-cols-1 gap-4 rounded-lg p-4 md:grid-cols-2">
            <div>
              <p className="font-medium">
                <span className="text-muted-foreground">Name:</span>{' '}
                <span className="text-foreground">{marksheet[0]?.student_name || 'N/A'}</span>
              </p>
              <p className="font-medium">
                <span className="text-muted-foreground">Roll:</span>{' '}
                <span className="text-foreground">{marksheet[0]?.roll || 'N/A'}</span>
              </p>
            </div>
            <div>
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

          {/* Merit Display */}
          {marksheet[0]?.final_merit && (
            <div className="mb-6 text-center">
              <span className="bg-primary/10 text-primary inline-block rounded-full px-4 py-2 font-semibold">
                Merit Position: {marksheet[0].final_merit}
              </span>
            </div>
          )}

          {/* Marks Table */}
          <div className="max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
            <table className="border-input w-full min-w-[320px] border-collapse overflow-hidden rounded-lg border">
              <thead className="bg-popover border-b border-gray-400">
                <tr className="bg-popover">
                  <th className="bg-popover sticky left-0 z-20 border-r px-3 py-3 text-center font-semibold shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] sm:px-4">
                    Subject
                  </th>
                  {marksheet[0]?.exam_marks &&
                    Object.keys(marksheet[0].exam_marks).map((exam) => (
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

          {/* Footer */}
          <div className="border-border mt-8 flex justify-end border-t pt-4">
            <button
              onClick={handleDownloadPDF}
              disabled={pdfLoading}
              className={`rounded-md px-6 py-2 font-medium transition-colors ${
                pdfLoading
                  ? 'bg-primary/80 cursor-not-allowed'
                  : 'bg-primary hover:bg-ring text-primary-foreground'
              } flex items-center gap-2`}
            >
              {pdfLoading ? (
                <>
                  <svg
                    className="h-5 w-5 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Downloading...
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  Download as PDF
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-card border-border rounded-lg border p-6 text-center shadow">
          <p className="text-muted-foreground">No marksheet data available.</p>
        </div>
      )}
    </div>
  );
}

export default ShowMarkSheet;
