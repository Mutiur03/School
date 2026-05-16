"use client";

import { getFileUrl } from "@/lib/cdn";
import { useMemo, useState } from "react";

interface Exam {
    id: number;
    exam_name: string;
    visible: boolean;
    levels: number[];
    start_date: string;
    routine?: string | null;
    download_url?: string | null;
}

interface ExamRoutineClientProps {
    exams: Exam[];
    initialSelectedId: number | null;
}

export default function ExamRoutineClient({
    exams,
    initialSelectedId
}: ExamRoutineClientProps) {
    const initialSelectedExam = useMemo(() => {
        if (!initialSelectedId) {
            return exams[0] ?? null;
        }
        return exams.find((exam) => exam.id === initialSelectedId) ?? exams[0] ?? null;
    }, [exams, initialSelectedId]);

    const [selectedExam, setSelectedExam] = useState<Exam | null>(initialSelectedExam);

    return (
        <div className="py-12">
            <div className="container-custom">
                <h1 className="section-title">Exam Routine</h1>
                {/* Exam selection */}
                <div className="mb-6">
                    <select
                        className="border rounded-xs px-3 py-2 focus:ring-2 focus:ring-primary focus:border-primary transition"
                        value={selectedExam?.id ?? ""}
                        onChange={(e) => {
                            const exam = exams.find((ex) => ex.id === Number(e.target.value));
                            setSelectedExam(exam ?? null);
                        }}
                        disabled={exams.length === 0}
                    >
                        <option value="" disabled>
                            Select an exam
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
                    {selectedExam?.routine ? (
                        <>
                            <div className="w-full flex justify-center">
                                <div
                                    className="w-full bg-gray-100 rounded-lg overflow-hidden border border-border shadow flex items-center justify-center"
                                    style={{
                                        maxWidth: 1200,
                                        width: "100%",
                                        height: "80vh", // responsive viewport-based height
                                        minHeight: 600, // ensure reasonable minimum
                                        maxHeight: 1000 // cap height on very tall screens
                                        // overflow: "auto" // allow the embedded viewer to scroll inside
                                    }}
                                >
                                    <iframe
                                        src={getFileUrl(selectedExam.routine)}
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
