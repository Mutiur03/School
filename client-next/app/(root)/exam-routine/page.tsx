import { api } from "@/lib/backend";
import ExamRoutineClient from "./ExamRoutineClient";

interface Exam {
    id: number;
    exam_name: string;
    visible: boolean;
    levels: number[];
    start_date: string;
    routine?: string | null;
    download_url?: string | null;
}

export const metadata = {
    title: "Exam Routine"
};

const getCurrentYearExams = (exams: Exam[]) => {
    const currentYear = new Date().getFullYear();
    return exams.filter((exam) => new Date(exam.start_date).getFullYear() === currentYear);
};

const getClosestExam = (exams: Exam[]) => {
    if (exams.length === 0) return null;

    const now = new Date();
    const sorted = [...exams].sort(
        (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );
    return sorted.find((exam) => new Date(exam.start_date) >= now) || sorted[sorted.length - 1];
};

export default async function ExamRoutinePage() {
    let exams: Exam[] = [];
    let selectedExamId: number | null = null;

    try {
        const examsRes = await api.get<Exam[] | { data: Exam[] }>("/api/exams/getExams", {
            revalidate: 60
        });
        const payload = examsRes.data;
        const allExams = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.data)
                ? payload.data
                : [];
        exams = getCurrentYearExams(allExams);
        selectedExamId = getClosestExam(exams)?.id ?? null;
    } catch {
        exams = [];
        selectedExamId = null;
    }

    return <ExamRoutineClient exams={exams} initialSelectedId={selectedExamId} />;
}
