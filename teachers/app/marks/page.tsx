'use client';
import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { useForm } from "react-hook-form";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/context/authContext";

// Types
type Student = {
    student_id: number;
    name: string;
    roll: number;
    section?: string;
    class: number | string;
    department?: string;
};

type Subject = {
    id: number;
    name: string;
    class: number | string;
    department?: string | null;
    teacher_name?: string;
    full_mark?: number;
    cq_mark?: number;
    mcq_mark?: number;
    practical_mark?: number;
};

type Exam = {
    exam_name: string;
    exam_year: number;
    levels?: (number | string)[];
};

type Marks = {
    subjectId: number;
    cq_marks: number | string;
    mcq_marks: number | string;
    practical_marks: number | string;
};

type StudentMarksData = {
    subjectMarks: Marks[];
};

type MarksData = {
    [studentId: number]: StudentMarksData;
};

type GPAData = {
    [studentId: number]: {
        gpa: number | string;
        student_id: number;
    };
};

type LoadingState = {
    initial: boolean;
    students: boolean;
    marks: boolean;
    submit: boolean;
};

type FormValues = {
    year: number;
    examName: string;
    level: string;
    department: string;
    section: string;
    specific: number;
};

const AddMarks: React.FC = () => {
    const {
        register,
        handleSubmit,
        watch,
        setValue,
        // formState: { errors },
    } = useForm<FormValues>({
        defaultValues: {
            year: new Date().getFullYear(),
            examName: "",
            level: "",
            department: "",
            section: "",
            specific: 0,
        },
    });
    const { teacher } = useAuth();
    // State management
    const [students, setStudents] = useState<Student[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [examList, setExamList] = useState<string[]>([]);
    const [loading, setLoading] = useState<LoadingState>({
        initial: true,
        students: false,
        marks: false,
        submit: false,
    });
    const [marksData, setMarksData] = useState<MarksData>({});
    const [gpaData, setGpaData] = useState<GPAData>({});

    // Form values
    const formValues = watch();
    const { year, examName, level, department, section, specific } = formValues;

    // Assigned classes and sections from teacher context
    const assignedClasses = useMemo(() => {
        if (!teacher?.levels) return [];
        // Unique class numbers
        return Array.from(new Set(teacher.levels.map(l => l.class_name)));
    }, [teacher]);

    const assignedSections = useMemo(() => {
        if (!teacher?.levels || !level) return [];
        // Unique sections for selected class
        return Array.from(new Set(
            teacher.levels
                .filter(l => l.class_name.toString() === level.toString())
                .map(l => l.section)
        ));
    }, [teacher, level]);

    // Fetch initial data
    const fetchInitialData = async (): Promise<void> => {
        try {
            setLoading((prev: LoadingState) => ({ ...prev, initial: true }));

            const [subjectsRes, examsRes]: [
                { data: { data: Subject[] } },
                { data: { data: Exam[] } }
            ] = await Promise.all([
                axios.get("/api/sub/getSubjects").catch(() => ({ data: { data: [] as Subject[] } })),
                axios.get("/api/exams/getExams").catch(() => ({ data: { data: [] as Exam[] } })),
            ]);

            setSubjects(subjectsRes.data?.data || []);
            console.log("Subjects:", subjectsRes.data?.data || []);
            const exams: Exam[] = examsRes.data?.data || [];
            const currentYearExams = exams.filter(
                (e: Exam) => e.exam_year === Number(year)
            );
            setExamList(currentYearExams.map((e: Exam) => e.exam_name));
            // Removed setClassList
        } catch (error: unknown) {
            console.error("Initial data error:", error);
            toast({
                title: "Failed to load initial data",
                description: "",
            });
        } finally {
            setLoading((prev: LoadingState) => ({ ...prev, initial: false }));
        }
    };

    // Fetch students after class selection
    const fetchStudents = async (): Promise<void> => {
        if (!level) {
            setStudents([]);
            return;
        }

        try {
            setLoading((prev: LoadingState) => ({ ...prev, students: true }));
            const studentsRes = await axios.get(
                `/api/students/getStudentsByClass/${year}/${level}`
            );
            const studentsData: Student[] = studentsRes.data?.data || [];
            setStudents(studentsData);
            console.log("Students:", studentsData);
        } catch (error: unknown) {
            console.error("Students fetch error:", error);
            toast({
                title: "Failed to load students",
                description: "",
            });
            setStudents([]);
        } finally {
            setLoading((prev: LoadingState) => ({ ...prev, students: false }));
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, [year]);

    useEffect(() => {
        setValue("level", ""); // Reset level when examName is empty
        setValue("department", "");
        setValue("section", "");
        setValue("specific", 0);
        setStudents([]); // Clear students when exam changes

        // Auto-set class for JSC and SSC
        if (examName === "JSC") {
            setValue("level", "8");
        } else if (examName === "SSC") {
            setValue("level", "10");
        }
    }, [examName, setValue]);

    useEffect(() => {
        if (level) {
            fetchStudents();
        } else {
            setStudents([]);
        }
    }, [level, year]);

    // Filtered data
    const filteredStudents = useMemo(() => {
        // Only filter if section is selected
        if (!section) return [];
        return students
            .filter((s: Student) => (department ? s.department === department : true))
            .filter((s: Student) => s.section === section)
            .sort((a: Student, b: Student) => a.roll - b.roll);
    }, [students, department, section]);

    const subjectsForClass = useMemo(() => {
        return subjects.filter((s: Subject) => s.class.toString() == level);
    }, [subjects, level]);

    useEffect(() => {
        if (!subjectsForClass.some((sub: Subject) => sub.id == specific)) {
            setValue("specific", 0);
        }
    }, [subjectsForClass, specific, setValue]);

    // Auto-select department when specific subject is chosen
    useEffect(() => {
        const selectedSubject = subjectsForClass.find(
            (sub: Subject) => sub.id == specific
        );
        if (specific && specific !== 0 && selectedSubject) {
            if (
                selectedSubject.department &&
                selectedSubject.department !== "" &&
                selectedSubject.department !== null
            ) {
                setValue("department", selectedSubject.department);
            } else {
                setValue("department", "");
            }
        } else if (specific === 0) {
            setValue("department", "");
        }
    }, [specific, subjectsForClass, setValue]);

    // Fetch existing marks
    const fetchExistingMarks = async (): Promise<void> => {
        if (
            !level ||
            !year ||
            !examName ||
            examName === "JSC" ||
            examName === "SSC"
        ) {
            setMarksData({});
            return;
        }

        try {
            setLoading((prev: LoadingState) => ({ ...prev, marks: true }));
            setMarksData({});
            const res = await axios.get(
                `/api/marks/getClassMarks/${level}/${year}/${examName}`
            );
            console.log("Marks data:", res.data);

            const marks = res.data?.data || [];
            const initialData: MarksData = {};
            marks.forEach((student: { student_id: number; marks?: Array<{ subject_id: number; cq_marks?: number; mcq_marks?: number; practical_marks?: number }> }) => {
                initialData[student.student_id] = {
                    subjectMarks: subjectsForClass.map((subject: Subject) => {
                        const existingMark = (student.marks || []).find(
                            (mark) => mark.subject_id === subject.id
                        );
                        return {
                            subjectId: subject.id,
                            cq_marks: existingMark?.cq_marks ?? 0,
                            mcq_marks: existingMark?.mcq_marks ?? 0,
                            practical_marks: existingMark?.practical_marks ?? 0,
                        };
                    }),
                };
            });
            console.log("Initial marks data:", initialData);

            setMarksData(initialData);
        } catch (error: unknown) {
            console.error("Marks fetch error:", error);
            toast({
                title: "Failed to load existing marks",
                description: "",
            });
        } finally {
            setLoading((prev: LoadingState) => ({ ...prev, marks: false }));
        }
    };

    const fetchGPA = async (): Promise<void> => {
        if (!year || !examName || (examName !== "JSC" && examName !== "SSC")) {
            setGpaData({});
            return;
        }

        try {
            setLoading((prev: LoadingState) => ({ ...prev, marks: true }));
            const res = await axios.get(`/api/marks/getGPA/${year}`);
            console.log("GPA data:", res.data);
            const gpaDatas = res.data?.data || [];

            const initialData: GPAData = {};
            if (examName == "JSC") {
                gpaDatas.forEach((student: { student_id: number; jsc_gpa: number }) => {
                    initialData[student.student_id] = {
                        student_id: student.student_id,
                        gpa: student.jsc_gpa,
                    };
                });
            } else if (examName == "SSC") {
                gpaDatas.forEach((student: { student_id: number; ssc_gpa: number }) => {
                    initialData[student.student_id] = {
                        student_id: student.student_id,
                        gpa: student.ssc_gpa,
                    };
                });
            }
            console.log("Initial GPA data:", initialData);
            setGpaData(initialData);
        } catch (error: unknown) {
            console.error("GPA fetch error:", error);
            toast({
                title: "Failed to load existing GPA",
                description: "",
            });
        } finally {
            setLoading((prev: LoadingState) => ({ ...prev, marks: false }));
        }
    };

    useEffect(() => {
        if (students.length > 0) {
            // Fetch marks/GPA data when students are loaded AND exam is selected
            if (examName === "JSC" || examName === "SSC") {
                fetchGPA();
            } else if (
                examName &&
                level &&
                examName !== "JSC" &&
                examName !== "SSC"
            ) {
                fetchExistingMarks();
            }
        } else {
            setMarksData({});
            setGpaData({});
        }
    }, [students, examName, level, year]);

    // Handle marks change
    const handleMarksChange = (
        studentId: number,
        subjectId: number,
        markType: keyof Marks,
        value: string
    ): void => {
        const subject = subjectsForClass.find((s: Subject) => s.id === subjectId);
        const marks = value;

        // Get max mark based on mark type and subject
        let maxMark = 100; // default fallback
        if (subject) {
            switch (markType) {
                case "cq_marks":
                    maxMark = subject.cq_mark || 0;
                    break;
                case "mcq_marks":
                    maxMark = subject.mcq_mark || 0;
                    break;
                case "practical_marks":
                    maxMark = subject.practical_mark || 0;
                    break;
            }
        }

        const validatedMarks =
            marks === ""
                ? 0
                : parseInt(marks) > maxMark
                    ? maxMark.toString()
                    : marks.slice(0, 3);

        setMarksData((prev: MarksData) => {
            const currentStudent = prev[studentId] || { subjectMarks: [] };
            const currentSubjectIndex = currentStudent.subjectMarks.findIndex(
                (m: Marks) => m.subjectId === subjectId
            );

            let updatedSubjectMarks: Marks[];
            if (currentSubjectIndex >= 0) {
                // Update existing subject marks
                updatedSubjectMarks = [...currentStudent.subjectMarks];
                updatedSubjectMarks[currentSubjectIndex] = {
                    ...updatedSubjectMarks[currentSubjectIndex],
                    [markType]: validatedMarks,
                };
            } else {
                // Add new subject marks
                updatedSubjectMarks = [
                    ...currentStudent.subjectMarks,
                    {
                        subjectId,
                        cq_marks: markType === "cq_marks" ? validatedMarks : 0,
                        mcq_marks: markType === "mcq_marks" ? validatedMarks : 0,
                        practical_marks:
                            markType === "practical_marks" ? validatedMarks : 0,
                    },
                ];
            }

            return {
                ...prev,
                [studentId]: {
                    ...currentStudent,
                    subjectMarks: updatedSubjectMarks,
                },
            };
        });
    };

    const handleGPAchange = (studentId: number, value: string): void => {
        setGpaData((prev: GPAData) => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                gpa: value,
            },
        }));
    };

    const onSubmit = async (): Promise<void> => {
        setLoading((prev: LoadingState) => ({ ...prev, submit: true }));
        if (examName === "SSC" || examName === "JSC") {
            const gpaDataToSend: Array<{ studentId: number; gpa: number | string }> = Object.entries(gpaData)
                .filter(([studentId]) => {
                    // Only include students that are currently visible/filtered
                    const student = filteredStudents.find(
                        (s: Student) => s?.student_id === Number(studentId)
                    );
                    return student; // This ensures only visible students are submitted
                })
                .map(([studentId, data]) => ({
                    studentId: parseInt(studentId),
                    gpa: data.gpa,
                }));

            console.log("Submitting GPA data:", gpaDataToSend);
            try {
                const response: { data: { message?: string } } = await axios.post("/api/marks/addGPA", {
                    students: gpaDataToSend,
                    examName,
                });
                toast({
                    title: response.data.message || "Marks saved successfully",
                    description: "",
                });
            } catch (error: unknown) {
                console.error("Submission error:", error);
                toast({
                    title: "Failed to save marks",
                    description: "",
                });
            }
            fetchGPA(); // Refresh GPA data after submission
            setLoading((prev: LoadingState) => ({ ...prev, submit: false }));
            return;
        }
        try {
            console.log("Submitting marks data:", marksData);

            // Get currently visible subjects based on filters
            const visibleSubjects: Subject[] = subjectsForClass.filter(
                (s: Subject) => !specific || s.id == specific
            );

            // Include all visible students, even those without marks entered
            const submissionData: Array<{ studentId: number; subjectMarks: Marks[] }> = filteredStudents.map((student: Student) => {
                const studentData = marksData[student.student_id];

                // Create subject marks for all visible subjects
                const subjectMarks: Marks[] = visibleSubjects.map((subject: Subject) => {
                    const existingMark = studentData?.subjectMarks?.find(
                        (m: Marks) => m.subjectId === subject.id
                    );
                    return {
                        subjectId: subject.id,
                        cq_marks: Math.max(0, parseInt(existingMark?.cq_marks as string) || 0),
                        mcq_marks: Math.max(0, parseInt(existingMark?.mcq_marks as string) || 0),
                        practical_marks: Math.max(
                            0,
                            parseInt(existingMark?.practical_marks as string) || 0
                        ),
                    };
                });

                return {
                    studentId: student.student_id,
                    subjectMarks: subjectMarks,
                };
            });

            console.log("Submission data:", submissionData);

            if (submissionData.length === 0) {
                throw new Error("No students found to submit marks for");
            }

            const response: { data: { message?: string } } = await axios.post("/api/marks/addMarks", {
                students: submissionData,
                examName,
                year,
            });

            toast({
                title: response.data.message || "Marks saved successfully",
                description: "",
            });
        } catch (error: unknown) {
            console.error("Submission error:", error);
            toast({
                title:
                    error instanceof Error
                        ? (typeof (error as unknown) === "object" &&
                            error !== null &&
                            "response" in error &&
                            typeof (error as { response?: { data?: { error?: string } } }).response === "object" &&
                            (error as { response?: { data?: { error?: string } } }).response?.data?.error
                        ) ||
                        error.message ||
                        "Failed to save marks"
                        : "Failed to save marks",
                description: "",
            });
        } finally {
            fetchExistingMarks();
            setLoading((prev: LoadingState) => ({ ...prev, submit: false }));
        }
    };

    // if (loading.initial) {
    //   return (
    //     <div className="flex justify-center items-center h-screen">
    //       <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    //     </div>
    //   );
    // }

    return (
        <div className="container mx-auto p-2 sm:p-4 max-w-7xl">
            <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 px-2 sm:px-0 text-foreground">
                Student Marks Management
            </h1>

            <form
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-4 sm:space-y-6"
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 bg-card p-4 sm:p-6 rounded-lg shadow">
                    {/* Year Select */}
                    <div className="col-span-1">
                        <label className="block text-sm font-medium mb-1 sm:mb-2">
                            Academic Year
                        </label>
                        <select
                            {...register("year", { required: true })}
                            className="w-full p-2 sm:p-3 border text-input dark:bg-accent rounded focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                            disabled={loading.initial}
                        >
                            {Array.from({ length: 10 }, (_, i) => (
                                <option key={i} value={2020 + i}>
                                    {2020 + i}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Exam Select */}
                    <div className="col-span-1">
                        <label className="block text-sm font-medium mb-1 sm:mb-2">
                            Examination
                        </label>
                        <select
                            {...register("examName", { required: true })}
                            className="w-full p-2 sm:p-3 text-input dark:bg-accent border rounded focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                            disabled={!year || loading.initial}
                        >
                            <option value="">Select Exam</option>
                            {examList.map((exam, index) => (
                                <option key={index} value={exam}>
                                    {exam}
                                </option>
                            ))}
                            {/* Only show JSC/SSC if teacher has access */}
                            {assignedClasses.includes(8) && (
                                <option value="JSC">JSC</option>
                            )}
                            {assignedClasses.includes(10) && (
                                <option value="SSC">SSC</option>
                            )}
                        </select>
                    </div>

                    {/* Class Select */}
                    <div className="col-span-1 sm:col-span-2 lg:col-span-1">
                        <label className="block text-sm font-medium mb-1 sm:mb-2">
                            Class/Grade
                        </label>
                        <select
                            {...register("level", { required: true })}
                            className="w-full p-2 sm:p-3 border text-input dark:bg-accent rounded focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                            disabled={
                                !examName ||
                                loading.initial ||
                                examName === "JSC" ||
                                examName === "SSC"
                            }
                            value={level}
                        >
                            <option value="">Select Class</option>
                            {examName === "JSC" ? (
                                assignedClasses.includes(8) && <option value="8">Class 8</option>
                            ) : examName === "SSC" ? (
                                assignedClasses.includes(10) && <option value="10">Class 10</option>
                            ) : (
                                assignedClasses
                                    .sort((a, b) => Number(a) - Number(b))
                                    .map((cls, index) => (
                                        <option key={index} value={cls}>
                                            Class {cls}
                                        </option>
                                    ))
                            )}
                        </select>
                    </div>

                    {/* Department Select */}
                    <div className="col-span-1">
                        <label className="block text-sm font-medium mb-1 sm:mb-2">
                            Department
                        </label>
                        <select
                            {...register("department")}
                            className="w-full p-2 sm:p-3 border text-input dark:bg-accent rounded focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                            disabled={!level || loading.initial}
                        >
                            {Number(level) >= 9
                                ? ["", "Science", "Arts", "Commerce"].map((dept) => (
                                    <option key={dept} value={dept}>
                                        {dept ? dept : "All Departments"}
                                    </option>
                                ))
                                : [""].map((dept) => (
                                    <option key={dept} value={dept}>
                                        {dept ? dept : "General"}
                                    </option>
                                ))}
                        </select>
                    </div>

                    {/* Section Select */}
                    <div className="col-span-1">
                        <label className="block text-sm font-medium mb-1 sm:mb-2">
                            Section <span className="text-red-500">*</span>
                        </label>
                        <select
                            {...register("section", { required: true })}
                            className="w-full p-2 sm:p-3 border text-input dark:bg-accent rounded focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                            disabled={!level || loading.initial}
                            value={section}
                        >
                            <option value="">Select Section</option>
                            {assignedSections.map((sec) => (
                                <option key={sec} value={sec}>
                                    Section {sec}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Subject Filter */}
                    <div className="col-span-1 sm:col-span-2 lg:col-span-1">
                        <label className="block text-sm font-medium mb-1 sm:mb-2">
                            Subject
                        </label>
                        <select
                            {...register("specific")}
                            className="w-full p-2 sm:p-3 border text-input dark:bg-accent rounded focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                            disabled={!level || loading.initial}
                        >
                            <option value={0}>Select Subject</option>
                            {examName !== "JSC" &&
                                examName !== "SSC" &&
                                subjectsForClass.map((sub) => (
                                    <option key={sub.id} value={sub.id}>
                                        {sub.name}
                                    </option>
                                ))}
                        </select>
                    </div>
                </div>

                {loading.initial ? (
                    <div className="flex flex-col justify-center items-center h-32 sm:h-64">
                        <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-t-2 border-b-2 border-primary"></div>
                        <span className="mt-2 sm:mt-3 text-sm sm:text-base text-muted-foreground text-center px-4">
                            Loading initial data...
                        </span>
                    </div>
                ) : loading.students ? (
                    <div className="flex flex-col justify-center items-center h-32 sm:h-64">
                        <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-t-2 border-b-2 border-primary"></div>
                        <span className="mt-2 sm:mt-3 text-sm sm:text-base text-muted-foreground text-center px-4">
                            Loading students...
                        </span>
                    </div>
                ) : loading.marks ? (
                    <div className="flex flex-col justify-center items-center h-32 sm:h-64">
                        <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-t-2 border-b-2 border-primary"></div>
                        <span className="mt-2 sm:mt-3 text-sm sm:text-base text-muted-foreground text-center px-4">
                            Loading marks data...
                        </span>
                    </div>
                ) : filteredStudents.length > 0 ? (
                    <div className="px-2 sm:px-0">
                        {examName !== "JSC" && examName !== "SSC" ? (
                            // Only show table if a specific subject is selected
                            specific && specific !== 0 ? (
                                <div className="overflow-x-auto bg-card rounded-lg shadow-sm border border-border">
                                    {/* Mobile Subject Header */}
                                    <div className="block sm:hidden bg-accent p-3 border-b border-border">
                                        <div className="text-sm font-semibold text-primary">
                                            Subject:{" "}
                                            {subjectsForClass.find((sub) => sub.id == specific)?.name}
                                        </div>
                                        <div className="text-xs text-primary mt-1">
                                            Teacher:{" "}
                                            {
                                                subjectsForClass.find((sub) => sub.id == specific)
                                                    ?.teacher_name
                                            }
                                        </div>
                                        <div>
                                            Total Marks:{" "}
                                            {subjectsForClass.find((sub) => sub.id == specific)
                                                ?.full_mark || 0}{" "}
                                        </div>
                                    </div>

                                    <table className="min-w-full divide-y divide-border">
                                        <thead className="bg-muted">
                                            {/* Desktop Subject Header */}
                                            <tr className="hidden sm:table-row bg-accent">
                                                <td className="px-6 py-2 text-sm font-semibold text-primary">
                                                    Subject:{" "}
                                                    {
                                                        subjectsForClass.find((sub) => sub.id == specific)
                                                            ?.name
                                                    }
                                                </td>
                                                <td
                                                    className="px-6 py-2 text-sm text-primary"
                                                    colSpan={2}
                                                >
                                                    Teacher:{" "}
                                                    {
                                                        subjectsForClass.find((sub) => sub.id == specific)
                                                            ?.teacher_name
                                                    }
                                                </td>
                                                <td
                                                    className="px-6 py-2 text-sm text-primary"
                                                    colSpan={1}
                                                >
                                                    Total Marks:{" "}
                                                    {subjectsForClass.find((sub) => sub.id == specific)
                                                        ?.full_mark || 0}
                                                </td>
                                            </tr>
                                            <tr>
                                                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-primary uppercase tracking-wider">
                                                    Student Info
                                                </th>
                                                {(() => {
                                                    const selectedSubject = subjectsForClass.find(
                                                        (sub) => sub.id == specific
                                                    );
                                                    return selectedSubject ? (
                                                        <>
                                                            <th className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-primary uppercase tracking-wider">
                                                                <span className="inline">
                                                                    CQ ({selectedSubject.cq_mark || 0})
                                                                </span>
                                                            </th>
                                                            <th className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-primary uppercase tracking-wider">
                                                                <span className="inline">
                                                                    MCQ ({selectedSubject.mcq_mark || 0})
                                                                </span>
                                                            </th>
                                                            <th className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-primary uppercase tracking-wider">
                                                                <span className="hidden sm:inline">
                                                                    Practical (
                                                                    {selectedSubject.practical_mark || 0})
                                                                </span>
                                                                <span className="sm:hidden">
                                                                    Prac ({selectedSubject.practical_mark || 0})
                                                                </span>
                                                            </th>
                                                        </>
                                                    ) : null;
                                                })()}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-card divide-y divide-border">
                                            {filteredStudents.map((student) => {
                                                const selectedSubject = subjectsForClass.find(
                                                    (sub) => sub.id == specific
                                                );

                                                if (!selectedSubject) {
                                                    return null;
                                                }

                                                if (
                                                    selectedSubject.department !== student.department &&
                                                    selectedSubject.department !== "" &&
                                                    selectedSubject.department !== null
                                                ) {
                                                    return (
                                                        <tr
                                                            key={student.student_id}
                                                            className="bg-muted"
                                                        >
                                                            <td className="px-3 sm:px-6 py-3 sm:py-4">
                                                                <div>
                                                                    <div className="text-sm font-medium text-foreground">
                                                                        {student.name}
                                                                    </div>
                                                                    <div className="text-xs sm:text-sm text-muted-foreground">
                                                                        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                                                            <span>Roll: {student.roll}</span>
                                                                            <span className="hidden sm:inline">
                                                                                |
                                                                            </span>
                                                                            <span>
                                                                                Sec: {student.section || "N/A"}
                                                                            </span>
                                                                            <span className="hidden sm:inline">
                                                                                |
                                                                            </span>
                                                                            <span>Class: {student.class}</span>
                                                                        </div>
                                                                        {student.department && (
                                                                            <span className="inline-block mt-1 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                                                                                {student.department}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td
                                                                colSpan={3}
                                                                className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm text-muted-foreground"
                                                            >
                                                                Subject not available for this student&apos;s
                                                                department
                                                            </td>
                                                        </tr>
                                                    );
                                                }

                                                const studentSubject = marksData[
                                                    student.student_id
                                                ]?.subjectMarks?.find(
                                                    (m) => m.subjectId === selectedSubject.id
                                                );

                                                const cqMarks = studentSubject?.cq_marks || 0;
                                                const mcqMarks = studentSubject?.mcq_marks || 0;
                                                const practicalMarks =
                                                    studentSubject?.practical_marks || 0;

                                                return (
                                                    <tr
                                                        key={student.student_id}
                                                        className="hover:bg-muted"
                                                    >
                                                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                                                            <div>
                                                                <div className="text-sm font-medium text-foreground">
                                                                    {student.name}
                                                                </div>
                                                                <div className="text-xs sm:text-sm text-muted-foreground">
                                                                    <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                                                        <span>Roll: {student.roll}</span>
                                                                        <span className="hidden sm:inline">|</span>
                                                                        <span>Sec: {student.section || "N/A"}</span>
                                                                        <span className="hidden sm:inline">|</span>
                                                                        <span>Class: {student.class}</span>
                                                                    </div>
                                                                    {student.department && (
                                                                        <span className="inline-block mt-1 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                                                                            {student.department}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-1 sm:px-6 py-3 sm:py-4 text-center">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max={selectedSubject.cq_mark || 100}
                                                                value={cqMarks}
                                                                onChange={(e) =>
                                                                    handleMarksChange(
                                                                        student.student_id,
                                                                        selectedSubject.id,
                                                                        "cq_marks",
                                                                        e.target.value
                                                                    )
                                                                }
                                                                disabled={
                                                                    !selectedSubject.cq_mark ||
                                                                    selectedSubject.cq_mark === 0
                                                                }
                                                                className={`w-12 sm:w-16 p-1 sm:p-2 border border-border rounded text-center text-xs sm:text-sm focus:ring-2 focus:ring-primary focus:border-transparent ${!selectedSubject.cq_mark ||
                                                                    selectedSubject.cq_mark === 0
                                                                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                                                                    : "bg-card"
                                                                    }`}
                                                            />
                                                        </td>
                                                        <td className="px-1 sm:px-6 py-3 sm:py-4 text-center">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max={selectedSubject.mcq_mark || 100}
                                                                value={mcqMarks}
                                                                onChange={(e) =>
                                                                    handleMarksChange(
                                                                        student.student_id,
                                                                        selectedSubject.id,
                                                                        "mcq_marks",
                                                                        e.target.value
                                                                    )
                                                                }
                                                                disabled={
                                                                    !selectedSubject.mcq_mark ||
                                                                    selectedSubject.mcq_mark === 0
                                                                }
                                                                className={`w-12 sm:w-16 p-1 sm:p-2 border border-border rounded text-center text-xs sm:text-sm focus:ring-2 focus:ring-primary focus:border-transparent ${!selectedSubject.mcq_mark ||
                                                                    selectedSubject.mcq_mark === 0
                                                                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                                                                    : "bg-card"
                                                                    }`}
                                                            />
                                                        </td>
                                                        <td className="px-1 sm:px-6 py-3 sm:py-4 text-center">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max={selectedSubject.practical_mark || 100}
                                                                value={practicalMarks}
                                                                onChange={(e) =>
                                                                    handleMarksChange(
                                                                        student.student_id,
                                                                        selectedSubject.id,
                                                                        "practical_marks",
                                                                        e.target.value
                                                                    )
                                                                }
                                                                disabled={
                                                                    !selectedSubject.practical_mark ||
                                                                    selectedSubject.practical_mark === 0
                                                                }
                                                                className={`w-12 sm:w-16 p-1 sm:p-2 border border-border rounded text-center text-xs sm:text-sm focus:ring-2 focus:ring-primary focus:border-transparent ${!selectedSubject.practical_mark ||
                                                                    selectedSubject.practical_mark === 0
                                                                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                                                                    : "bg-card"
                                                                    }`}
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                // Show message when no subject is selected
                                <div className="p-6 sm:p-8 rounded-lg bg-muted shadow text-center mx-2 sm:mx-0">
                                    <p className="text-sm sm:text-base text-muted-foreground">
                                        Please select a subject from the dropdown above to enter
                                        marks for students.
                                    </p>
                                </div>
                            )
                        ) : (
                            // JSC/SSC GPA Table - always show
                            <div className="overflow-x-auto bg-card rounded-lg shadow-sm border border-border">
                                <table className="min-w-full divide-y divide-border">
                                    <thead className="bg-muted">
                                        <tr>
                                            <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                                Student Info
                                            </th>
                                            <th className="px-3 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                                <span className="hidden sm:inline">
                                                    GPA (Out of 5.00)
                                                </span>
                                                <span className="sm:hidden">GPA</span>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-card divide-y divide-border">
                                        {filteredStudents.map((student) => (
                                            <tr
                                                key={student.student_id}
                                                className="hover:bg-muted"
                                            >
                                                <td className="px-3 sm:px-6 py-3 sm:py-4">
                                                    <div>
                                                        <div className="text-sm font-medium text-foreground">
                                                            {student.name}
                                                        </div>
                                                        <div className="text-xs sm:text-sm text-muted-foreground">
                                                            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                                                <span>Roll: {student.roll}</span>
                                                                <span className="hidden sm:inline">|</span>
                                                                <span>Sec: {student.section || "N/A"}</span>
                                                                <span className="hidden sm:inline">|</span>
                                                                <span>Class: {student.class}</span>
                                                            </div>
                                                            {student.department && (
                                                                <span className="inline-block mt-1 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                                                                    {student.department}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        max="5"
                                                        value={gpaData[student.student_id]?.gpa || ""}
                                                        onChange={(e) => {
                                                            let val = e.target.value;
                                                            if (parseFloat(val) > 5) val = "5.00";
                                                            if (val && val.includes(".")) {
                                                                const [intPart, decPart] = val.split(".");
                                                                val = intPart + "." + decPart.slice(0, 2);
                                                            }
                                                            handleGPAchange(student.student_id, val);
                                                        }}
                                                        className="w-16 sm:w-24 p-2 sm:p-3 border border-border rounded-md focus:ring-2 focus:ring-primary focus:border-transparent text-center font-semibold bg-card text-sm sm:text-base"
                                                        placeholder="0.00"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="p-6 sm:p-8 rounded-lg bg-muted shadow text-center mx-2 sm:mx-0">
                        <p className="text-sm sm:text-base text-muted-foreground">
                            {!level
                                ? "Please select a class to view students"
                                : students.length === 0
                                    ? "No students found in the system for the selected class"
                                    : "No students match the selected filters"}
                        </p>
                    </div>
                )}

                {filteredStudents.length > 0 &&
                    (examName === "JSC" ||
                        examName === "SSC" ||
                        (examName !== "JSC" &&
                            examName !== "SSC" &&
                            specific &&
                            specific !== 0)) &&
                    (subjectsForClass.find((sub) => sub.id == specific)?.full_mark ?? 0) > 0 &&
                    (subjectsForClass.find((sub) => sub.id == specific)?.cq_mark ||
                        subjectsForClass.find((sub) => sub.id == specific)?.mcq_mark ||
                        subjectsForClass.find((sub) => sub.id == specific)
                            ?.practical_mark) && (
                        <div className="flex justify-center sm:justify-end px-2 sm:px-0">
                            <button
                                type="submit"
                                className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-primary text-primary-foreground rounded hover:bg-primary/80 disabled:bg-primary/30 flex items-center justify-center text-sm sm:text-base font-medium"
                                disabled={loading.submit}
                            >
                                {loading.submit ? (
                                    <>
                                        <svg
                                            className="animate-spin -ml-1 mr-2 h-4 w-4 text-primary-foreground"
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
                                        Processing...
                                    </>
                                ) : (
                                    `Save ${examName === "JSC" || examName === "SSC" ? "GPA" : "Marks"
                                    }`
                                )}
                            </button>
                        </div>
                    )}
            </form>
        </div>
    );
};

export default AddMarks;
