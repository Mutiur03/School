import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

interface AdmissionResult {
    id: number;
    class_name: string;
    admission_year: number;
    merit_list: string | null;
    waiting_list_1: string | null;
    waiting_list_2: string | null;
    created_at: string;
}

interface ListType {
    key: "merit_list" | "waiting_list_1" | "waiting_list_2";
    label: string;
    color: string;
}

function AdmissionResult() {
    const { classNumber } = useParams<{ classNumber: string }>();
    const [result, setResult] = useState<AdmissionResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [admissionYear, setAdmissionYear] = useState<number>(new Date().getFullYear());
    const [availableYears, setAvailableYears] = useState<number[]>([]);

    const listTypes: ListType[] = [
        { key: "merit_list", label: "Merit List", color: "green" },
        { key: "waiting_list_1", label: "Waiting List 1", color: "yellow" },
        { key: "waiting_list_2", label: "Waiting List 2", color: "orange" },
    ];

    const getAvailableYears = (baseYear: number) => {
        return [baseYear, baseYear - 1, baseYear - 2];
    };

    useEffect(() => {
        fetchAdmissionYear();
    }, []);

    useEffect(() => {
        if (classNumber && admissionYear) {
            fetchResult();
        }
    }, [classNumber, admissionYear]);

    const fetchAdmissionYear = async () => {
        try {
            const res = await axios.get("/api/admission");
            setAdmissionYear(res.data.admission_year);
            setAvailableYears(getAvailableYears(res.data.admission_year));
        } catch (error) {
            console.error("Failed to fetch admission year:", error);
            setAvailableYears(getAvailableYears(admissionYear));
        }
    };

    const fetchResult = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get("/api/admission-result");
            const results: AdmissionResult[] = response.data;

            const classResult = results.find(
                (r) => r.class_name === classNumber && r.admission_year === admissionYear
            );

            setResult(classResult || null);
        } catch (error) {
            console.error("Error fetching results:", error);
            toast.error("Failed to fetch admission results");
        } finally {
            setIsLoading(false);
        }
    };

    const getFileStatus = (fileUrl: string | null) => {
        return fileUrl ? (
            <div className="flex items-center gap-1 text-green-600">
                <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <span className="text-xs">Available</span>
            </div>
        ) : (
            <div className="flex items-center gap-1 text-gray-400">
                <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                >
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
                <span className="text-xs">Not Available</span>
            </div>
        );
    };

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-8">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-4">
                    <div>
                        <h1 className="text-3xl font-bold mb-2 text-gray-800">
                            Admission Result - Class {classNumber}
                        </h1>
                        <p className="text-gray-600">
                            Academic Year: {admissionYear}
                        </p>
                    </div>

                    {/* Year Selector */}
                    <div className="flex items-center gap-2">
                        <label htmlFor="year-select" className="text-sm font-semibold text-gray-700">
                            Select Year:
                        </label>
                        <select
                            id="year-select"
                            value={admissionYear}
                            onChange={(e) => setAdmissionYear(parseInt(e.target.value))}
                            className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-800 font-medium hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                        >
                            {availableYears.map((year) => (
                                <option key={year} value={year}>
                                    {year}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="flex justify-center items-center py-20">
                    <svg
                        className="h-10 w-10 animate-spin text-blue-600"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <line x1="12" y1="2" x2="12" y2="6"></line>
                        <line x1="12" y1="18" x2="12" y2="22"></line>
                        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                        <line x1="2" y1="12" x2="6" y2="12"></line>
                        <line x1="18" y1="12" x2="22" y2="12"></line>
                        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                    </svg>
                </div>
            )}

            {/* No Result Found */}
            {!isLoading && !result && (
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-12 text-center">
                    <svg
                        className="h-16 w-16 mx-auto mb-4 text-gray-400"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">
                        No Results Published Yet
                    </h3>
                    <p className="text-gray-500">
                        Admission results for Class {classNumber} have not been published yet.
                        Please check back later.
                    </p>
                </div>
            )}

            {/* Result Display */}
            {!isLoading && result && (
                <div className="bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden">
                    <div className="bg-linear-to-r from-blue-600 to-blue-700 p-6 text-white">
                        <h2 className="text-2xl font-bold mb-1">
                            Class {result.class_name} - Admission {result.admission_year}
                        </h2>
                        {/* <p className="text-blue-100 text-lg">
                            Published on: {new Date(result.created_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </p> */}
                    </div>

                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {listTypes.map((listType) => (
                                <div
                                    key={listType.key}
                                    className="border border-gray-200 rounded-lg p-5 bg-gray-50 hover:shadow-md transition-shadow"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <h4 className="text-base font-semibold text-gray-800">
                                            {listType.label}
                                        </h4>
                                        {getFileStatus(result[listType.key])}
                                    </div>

                                    {result[listType.key] ? (
                                        <a
                                            href={result[listType.key]!}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white! rounded-md hover:bg-blue-700 transition-colors text-sm font-medium w-full justify-center"
                                        >
                                            <svg
                                                className="h-4 w-4"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                            >
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                                <circle cx="12" cy="12" r="3"></circle>
                                            </svg>
                                            View PDF
                                        </a>
                                    ) : (
                                        <div className="text-center py-2 text-gray-500 text-sm">
                                            Not available yet
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Important Instructions */}
                        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-5">
                            <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
                                <svg
                                    className="h-5 w-5"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="16" x2="12" y2="12"></line>
                                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                </svg>
                                Important Instructions
                            </h3>
                            <ul className="space-y-2 text-sm text-blue-900">
                                <li className="flex items-start gap-2">
                                    <span className="text-blue-600 font-bold mt-0.5">•</span>
                                    <span>Download and check your roll number carefully in the PDF file.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-blue-600 font-bold mt-0.5">•</span>
                                    <span>If you are on the waiting list, you will be notified if a seat becomes available.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-blue-600 font-bold mt-0.5">•</span>
                                    <span>For any queries, please contact the school administration office.</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdmissionResult;
