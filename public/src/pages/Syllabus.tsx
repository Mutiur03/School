"use client";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import axios from "axios";

export type Syllabus = {
    id: number;
    class: number;
    year: number;
    pdf_url: string;
    download_url: string;
    public_id: string;
    created_at: string;
};

export default function SyllabusPage() {
    const [syllabuses, setSyllabuses] = useState<Syllabus[]>([]);
    const [selectedYear, setSelectedYear] = useState<{ [key: number]: number }>(
        {}
    );

    useEffect(() => {
        axios.get("/api/syllabus").then((res) => setSyllabuses(res.data));
    }, []);

    // Get all available years for a class
    const getYearsForClass = (classNum: number) => {
        const years = syllabuses
            .filter((s) => s.class === classNum)
            .map((s) => s.year);
        return Array.from(new Set(years)).sort((a, b) => b - a); // Descending order
    };

    // Get syllabus for class and year
    const getSyllabus = (classNum: number, year: number) =>
        syllabuses.find((s) => s.class === classNum && s.year === year);

    // Set default year to current year if available, otherwise first available year
    useEffect(() => {
        const currentYear = new Date().getFullYear();
        const newSelected: { [key: number]: number } = {};
        [6, 7, 8, 9, 10].forEach((classNum) => {
            const years = getYearsForClass(classNum);
            if (years.length > 0) {
                newSelected[classNum] = years.includes(currentYear)
                    ? currentYear
                    : years[0];
            }
        });
        setSelectedYear((prev) => ({ ...newSelected, ...prev }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [syllabuses]);

    return (
        <div className="py-12">
            <div className="container-custom">
                <h1 className="section-title">Class Syllabus</h1>
                <div className="mt-8">
                    <Tabs defaultValue="class6" className="w-full">
                        <TabsList className=" mb-8">
                            {[6, 7, 8, 9, 10].map((classNum) => (
                                <TabsTrigger value={`class${classNum}`} key={classNum}>
                                    Class {classNum}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        {[6, 7, 8, 9, 10].map((classNum) => {
                            const years = getYearsForClass(classNum);
                            const selected = selectedYear[classNum] ?? years[0];
                            const syllabus = selected
                                ? getSyllabus(classNum, selected)
                                : null;
                            return (
                                <TabsContent value={`class${classNum}`} key={classNum}>
                                    <div className="mb-6">
                                        <h2 className="text-lg font-semibold mb-2">
                                            Select Year
                                        </h2>
                                        {years.length === 0 ? (
                                            <div className="text-gray-500 p-4 border rounded bg-gray-50">
                                                Syllabus will be updated soon.
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {years.map((year) => (
                                                    <button
                                                        key={year}
                                                        className={`px-4 py-2 rounded border transition ${selected === year
                                                            ? "bg-primary text-white border-primary"
                                                            : "bg-white text-primary border-primary hover:bg-primary/10"
                                                            }`}
                                                        onClick={() =>
                                                            setSelectedYear((prev) => ({
                                                                ...prev,
                                                                [classNum]: year,
                                                            }))
                                                        }
                                                    >
                                                        {year}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {syllabus ? (
                                        <div className="p-6 border rounded bg-blue-50 flex flex-col items-center">
                                            <div className="mb-4 text-center">
                                                <span className="font-medium text-blue-900">
                                                    Syllabus for Class {classNum}, Year{" "}
                                                    {selected}
                                                </span>
                                            </div>
                                            <div className="flex gap-4">
                                                <a
                                                    href={syllabus.pdf_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="px-6 py-2 bg-primary text-white rounded shadow hover:bg-primary/90 transition"
                                                >
                                                    View Syllabus
                                                </a>
                                                <a
                                                    href={syllabus.download_url}
                                                    download
                                                    className="px-6 py-2 bg-green-600 text-white rounded shadow hover:bg-green-700 transition"
                                                >
                                                    Download
                                                </a>
                                            </div>
                                            {/* Syllabus PDF Preview */}
                                            <div className="w-full flex justify-center mt-6">
                                                <div className="w-full bg-gray-100 rounded-lg overflow-hidden border border-border shadow aspect-video max-h-[90vh] min-h-[600px] flex items-center justify-center">
                                                    <iframe
                                                        src={syllabus.pdf_url}
                                                        title={`Syllabus PDF Class ${classNum} Year ${selected}`}
                                                        className="w-full h-full"
                                                        style={{
                                                            border: "none",
                                                            minHeight: "600px",
                                                            maxHeight: "90vh"
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : years.length > 0 ? (
                                        <div className="text-gray-500 p-4 border rounded bg-gray-50 mt-4">
                                            Syllabus not available for the selected year.
                                        </div>
                                    ) : null}
                                </TabsContent>
                            );
                        })}
                    </Tabs>
                </div>
                <div className="mt-8 bg-blue-50 border-l-4 border-blue-400 p-4">
                    <h3 className="text-lg font-medium text-blue-800">Note:</h3>
                    <ul className="mt-2 space-y-1 text-blue-700">
                        <li>• Syllabus is subject to change as per school guidelines.</li>
                        <li>
                            • Students should refer to the latest textbooks and teacher
                            instructions.
                        </li>
                        <li>• For detailed syllabus, contact the class teacher.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
