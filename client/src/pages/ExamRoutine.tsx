"use client"
import { useEffect, useState } from "react";
import axios from "axios";

interface Exam {
    id: number;
    exam_name: string;
    visible: boolean;
    levels: number[];
    start_date: string;
    routine?: string | null;
    download_url?: string | null;
}

export default function ExamRoutinePage() {
    const [exams, setExams] = useState<Exam[]>([]);
    const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    // Fetch exams on mount
    useEffect(() => {
        const fetchExams = async () => {
            setLoading(true);
            try {
                const examsRes = await axios.get<{ data: Exam[] }>("/api/exams/getExams");
                const allExams: Exam[] = examsRes.data.data;
                const currentYear = new Date().getFullYear();
                const currentYearExams = allExams.filter(
                    (e) => new Date(e.start_date).getFullYear() === currentYear
                );
                setExams(currentYearExams);

                // Find the closest (upcoming or most recent) exam
                if (currentYearExams.length > 0) {
                    const now = new Date();
                    // Sort by date ascending, then pick the first exam with start_date >= now, else pick the latest past exam
                    const sorted = [...currentYearExams].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
                    const closestExam = sorted.find(e => new Date(e.start_date) >= now) || sorted[sorted.length - 1];
                    setSelectedExam(closestExam);
                } else {
                    setSelectedExam(null);
                }
            } catch {
                setExams([]);
                setSelectedExam(null);
            }
            setLoading(false);
        };
        fetchExams();
    }, []);

    // Find the PDF routine for the selected exam
    const pdfRoutineUrl = selectedExam?.routine || null;
    // const pdfDownloadUrl = selectedExam?.download_url || (pdfRoutineUrl
    //     ? pdfRoutineUrl.replace("/upload/", "/upload/fl_attachment/")
    //     : null);

    return (
        <div className="py-12">
            <div className="container-custom">
                <h1 className="section-title">Exam Routine</h1>
                {/* Exam selection */}
                <div className="mb-6">
                    <select
                        className="border rounded-xs px-3 py-2 focus:ring-2 focus:ring-primary focus:border-primary transition"
                        value={selectedExam?.id ?? ""}
                        onChange={e => {
                            const exam = exams.find(ex => ex.id === Number(e.target.value));
                            setSelectedExam(exam ?? null);
                        }}
                        disabled={loading || exams.length === 0}
                    >
                        <option value="" disabled>
                            {loading ? "Loading exams..." : "Select an exam"}
                        </option>
                        {exams.map((exam) => (
                            <option key={exam.id} value={exam.id}>
                                {exam.exam_name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="mt-8 flex flex-col items-center">
                    {/* PDF Routine section */}
                    {pdfRoutineUrl ? (
                        <>
                            {/* <div className="mb-8 flex flex-col sm:flex-row items-center gap-4">
                                <a
                                    href={pdfRoutineUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center px-4 py-2 bg text-white rounded-xs shadow hover:bg-primary-dark transition font-medium"
                                    // style={{ backgroundColor: "#2563eb" }} // Tailwind blue-600
                                >
                                    View Routine
                                </a>
                                {pdfDownloadUrl && (
                                    <a
                                        href={pdfDownloadUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded shadow hover:bg-green-700 transition font-medium"
                                        style={{ backgroundColor: "#16a34a" }} // Tailwind green-600
                                        download
                                    >
                                        Download Routine
                                    </a>
                                )}
                            </div> */}
                            {/* PDF Preview */}
                            <div className="w-full flex justify-center">
                                <div
                                    className="w-full bg-gray-100 rounded-lg overflow-hidden border border-border shadow flex items-center justify-center"
                                    style={{
                                        maxWidth: 1200,
                                        width: "100%",
                                        height: "80vh",      // responsive viewport-based height
                                        minHeight: 600,      // ensure reasonable minimum
                                        maxHeight: 1000,     // cap height on very tall screens
                                        // overflow: "auto"     // allow the embedded viewer to scroll inside
                                    }}
                                >
                                    <iframe
                                        src={pdfRoutineUrl}
                                        title="Exam Routine PDF"
                                        className="w-full h-full block"
                                        style={{
                                            border: "none",
                                            width: "100%",
                                            height: "100%",
                                            minHeight: "600px"
                                        }}
                                    />
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="bg-gray-50 p-8 rounded-lg text-center">
                            <h3 className="text-xl font-medium text-gray-600">
                                Exam Routine
                            </h3>
                            <p className="mt-2 text-gray-500">
                                Exam routine will be updated soon.
                            </p>
                        </div>
                    )}
                </div>
                <div className="mt-8 bg-yellow-50 border-l-4 border-yellow-400 p-4">
                    <h3 className="text-lg font-medium text-yellow-800">Note:</h3>
                    <ul className="mt-2 space-y-1 text-yellow-700">
                        <li>
                            • Exam starts at 10 AM. Students must arrive at least 20 minutes
                            before the exam.
                        </li>
                        <li>• Bring your admit card and necessary stationery.</li>
                        <li>
                            • No mobile phones or electronic devices are allowed in the exam
                            hall.
                        </li>
                        <li>• Follow all instructions given by the invigilators.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
