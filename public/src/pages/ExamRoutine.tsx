"use client"
import { useEffect, useState } from "react";
import axios from "axios";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CLASS_LIST = [6, 7, 8, 9, 10];

interface Exam {
    id: number;
    exam_name: string;
    visible: boolean;
    levels: number[];
    start_date: string;
}

interface Routine {
    id: number;
    date: string;
    day: string;
    subject: string;
}

export default function ExamRoutinePage() {
    const [exams, setExams] = useState<Exam[]>([]);
    const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
    const [selectedClass, setSelectedClass] = useState<number | null>(null);
    const [routines, setRoutines] = useState<{ [key: number]: Routine[] }>({});
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

                    // Pick the lowest class available for that exam
                    const available = closestExam.levels.filter((cls) => CLASS_LIST.includes(cls));
                    if (available.length > 0) {
                        setSelectedClass(Math.min(...available));
                    } else {
                        setSelectedClass(null);
                    }
                } else {
                    setSelectedExam(null);
                    setSelectedClass(null);
                }
            } catch {
                setExams([]);
                setSelectedExam(null);
                setSelectedClass(null);
            }
            setLoading(false);
        };
        fetchExams();
    }, []);

    // Fetch routines when selectedExam changes
    useEffect(() => {
        if (!selectedExam) {
            setRoutines({});
            return;
        }
        const fetchRoutines = async () => {
            setLoading(true);
            try {
                const routineData: { [key: number]: Routine[] } = {};
                await Promise.all(
                    selectedExam.levels.map(async (cls) => {
                        const routineRes = await axios.get<{ data: Routine[] }>("/api/exams/getExamRoutines", {
                            params: { exam_id: selectedExam.id, class: cls },
                        });
                        routineData[cls] = routineRes.data.data;
                    })
                );
                setRoutines(routineData);

                // If selectedClass is not in available, set to lowest available
                const available = selectedExam.levels.filter((cls) => CLASS_LIST.includes(cls));
                if (!selectedClass || !available.includes(selectedClass)) {
                    if (available.length > 0) setSelectedClass(Math.min(...available));
                    else setSelectedClass(null);
                }
            } catch {
                setRoutines({});
            }
            setLoading(false);
        };
        fetchRoutines();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedExam]);

    // Only show classes available for selected exam
    const availableClasses = selectedExam ? selectedExam.levels.filter((cls) => CLASS_LIST.includes(cls)) : [];

    return (
        <div className="py-12">
            <div className="container-custom">
                <h1 className="section-title">Exam Routine</h1>
                {/* Exam selection */}
                <div className="mb-6">
                    {/* <label className="block mb-2 font-medium text-gray-700">Select Exam:</label> */}
                    <select
                        className="border rounded px-3 py-2"
                        value={selectedExam?.id ?? ""}
                        onChange={e => {
                            const exam = exams.find(ex => ex.id === Number(e.target.value));
                            setSelectedExam(exam ?? null);
                            if (exam) {
                                const available = exam.levels.filter((cls) => CLASS_LIST.includes(cls));
                                setSelectedClass(available.length > 0 ? Math.min(...available) : null);
                            } else {
                                setSelectedClass(null);
                            }
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
                <div className="mt-8">
                    <Tabs
                        value={selectedClass ? `class${selectedClass}` : ""}
                        onValueChange={val => {
                            const cls = Number(val.replace("class", ""));
                            setSelectedClass(cls);
                        }}
                        className="w-full"
                    >
                        <TabsList className={` mb-8`}>
                            {availableClasses.map((cls) => (
                                <TabsTrigger key={cls} value={`class${cls}`}>{`Class ${cls}`}</TabsTrigger>
                            ))}
                        </TabsList>
                        {availableClasses.map((cls) => (
                            <TabsContent key={cls} value={`class${cls}`}>
                                <div className="overflow-x-auto">
                                    {loading ? (
                                        <div className="py-8 text-center text-gray-500">Loading...</div>
                                    ) : routines[cls] && routines[cls].length > 0 ? (
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="bg-primary text-white">
                                                    <th className="border p-2">Date</th>
                                                    <th className="border p-2">Day</th>
                                                    <th className="border p-2">Subject</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {routines[cls].map((r: Routine) => (
                                                    <tr key={r.id} className="hover:bg-gray-50">
                                                        <td className="border p-2">{r.date}</td>
                                                        <td className="border p-2 font-medium">{r.day}</td>
                                                        <td className="border p-2">{r.subject}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="bg-gray-50 p-8 rounded-lg text-center">
                                            <h3 className="text-xl font-medium text-gray-600">
                                                Class {cls} Exam Routine
                                            </h3>
                                            <p className="mt-2 text-gray-500">
                                                Exam routine will be updated soon.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        ))}
                    </Tabs>
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
