import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import Loading from "../components/Loading";
function ShowMarkSheet() {
  const { studentId, year } = useParams();
  const [marksheet, setMarksheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMarkSheet = async () => {
      if (!studentId || !year) {
        setError("Invalid student ID or year.");
        setLoading(false);
        return;
      }
      try {
        const response = await axios.get(
          `/api/marks/${studentId}/${year}/preview`
        );
        if (response.status !== 200)
          throw new Error("Failed to fetch marksheet.");
        console.log("Marksheet data:", response.data);

        setMarksheet(response.data);
      } catch (err) {
        console.error("Error fetching marksheet:", err);
        setError("Marks sheet not found. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchMarkSheet();
  }, [studentId, year]);

  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      const host = import.meta.env.VITE_BACKEND_URL;
      const url = `${host}/api/marks/${studentId}/${year}/download`;
      window.open(url, "_blank");
    } catch (err) {
      console.error("Download failed:", err);
      alert("Failed to download PDF. Please try again.");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 font-outfit">
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64">
          <Loading />
        </div>
      ) : error ? (
        <div className="bg-destructive/10 p-4 rounded-lg border border-destructive/20">
          <p className="text-destructive text-center">{error}</p>
        </div>
      ) : marksheet && marksheet.length > 0 ? (
        <>
          <div className="p-6 rounded-lg bg-card text-card-foreground shadow-lg border border-border">
            {/* School Header */}
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-primary">
                Panchbibi Lal Bihari Pilot Govt. High School
              </h1>
              <h3 className="text-muted-foreground">Panchbibi, Joypurhat</h3>
              <div className="my-4 border-t border-border"></div>
              <h2 className="text-xl font-semibold">Academic Marksheet</h2>
            </div>

            {/* Student Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 rounded-lg">
              <div>
                <p className="font-medium">
                  <span className="text-muted-foreground">Name:</span>{" "}
                  <span className="text-foreground">
                    {marksheet[0]?.student_name || "N/A"}
                  </span>
                </p>
                <p className="font-medium">
                  <span className="text-muted-foreground">Roll:</span>{" "}
                  <span className="text-foreground">
                    {marksheet[0]?.roll || "N/A"}
                  </span>
                </p>
              </div>
              <div>
                <p className="font-medium">
                  <span className="text-muted-foreground">Class:</span>{" "}
                  <span className="text-foreground">
                    {marksheet[0]?.class || "N/A"}
                  </span>
                </p>
                <p className="font-medium">
                  <span className="text-muted-foreground">Year:</span>{" "}
                  <span className="text-foreground">
                    {marksheet[0]?.year || "N/A"}
                  </span>
                </p>
              </div>
            </div>

            {/* Merit Display */}
            {marksheet[0]?.final_merit && (
              <div className="mb-6 text-center">
                <span className="inline-block px-4 py-2 bg-primary/10 text-primary font-semibold rounded-full">
                  Merit Position: {marksheet[0].final_merit}
                </span>
              </div>
            )}

            {/* Marks Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse rounded-lg border border-input overflow-hidden">
                <thead className="bg-popover border-b border-gray-400">
                  <tr className="bg-popover">
                    <th className="px-4 py-3 text-center font-semibold ">
                      Subject
                    </th>
                    {marksheet[0]?.exam_marks &&
                      Object.keys(marksheet[0].exam_marks).map((exam) => (
                        <th
                          key={exam}
                          className="px-4 py-3 text-center font-semibold "
                        >
                          {exam}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-400">
                  {marksheet.map((entry, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3  font-medium">
                        {entry.subject}
                      </td>
                      {Object.keys(entry.exam_marks || {}).map((exam, idx) => (
                        <td key={idx} className="px-4 py-3 text-center ">
                          {entry.exam_marks[exam]}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="bg-slate-50 dark:bg-slate-800 text-center font-semibold">
                    <td className="px-4 py-3">Total</td>
                    {marksheet[0]?.total_marks_per_exam &&
                      Object.keys(marksheet[0].total_marks_per_exam).map(
                        (exam) => (
                          <td key={exam} className="px-4 py-3 text-center ">
                            {marksheet[0].total_marks_per_exam[exam]}
                          </td>
                        )
                      )}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-border flex justify-end">
              <button
                onClick={handleDownloadPDF}
                disabled={pdfLoading}
                className={`px-6 py-2 rounded-md font-medium transition-colors ${
                  pdfLoading
                    ? "bg-primary/80 cursor-not-allowed"
                    : "bg-primary hover:bg-ring text-primary-foreground"
                } flex items-center gap-2`}
              >
                {pdfLoading ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5"
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
        </>
      ) : (
        <div className="bg-card p-6 rounded-lg border border-border shadow text-center">
          <p className="text-muted-foreground">No marksheet data available.</p>
        </div>
      )}
    </div>
  );
}

export default ShowMarkSheet;
