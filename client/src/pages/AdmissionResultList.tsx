import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

function AdmissionResultList() {
    const [results, setResults] = useState<AdmissionResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [admissionYear, setAdmissionYear] = useState<number>(new Date().getFullYear());
    const [currentAdmissionYear, setCurrentAdmissionYear] = useState<number>(new Date().getFullYear());

    useEffect(() => {
        fetchAdmissionYear();
        fetchResults();
    }, []);

    const fetchAdmissionYear = async () => {
        try {
            const res = await axios.get("/api/admission");
            setCurrentAdmissionYear(res.data.admission_year);
            setAdmissionYear(res.data.admission_year);
        } catch (error) {
            console.error("Failed to fetch admission year:", error);
        }
    };

    const fetchResults = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get("/api/admission-result");
            setResults(response.data);
        } catch (error) {
            console.error("Error fetching results:", error);
            toast.error("Failed to fetch admission results");
        } finally {
            setIsLoading(false);
        }
    };

    const getAvailableYears = () => {
        const current = currentAdmissionYear;
        const uniqueYears = [current, current - 1, current - 2];
        return uniqueYears;
    };

    const getResultsForYear = () => {
        return results.filter((r) => r.admission_year === admissionYear);
    };

    const hasAnyList = (result: AdmissionResult) => {
        return result.merit_list || result.waiting_list_1 || result.waiting_list_2;
    };

    const getAvailableListsCount = (result: AdmissionResult) => {
        let count = 0;
        if (result.merit_list) count++;
        if (result.waiting_list_1) count++;
        if (result.waiting_list_2) count++;
        return count;
    };

    const yearResults = getResultsForYear();
    const classes = ["6", "7", "8", "9"];

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-6">
                    <div>
                        <h1 className="text-4xl font-bold mb-3 text-gray-800">
                            Admission Results
                        </h1>
                        <p className="text-gray-600 text-lg">
                            View admission results for Academic Year {admissionYear}
                        </p>
                    </div>

                    {/* Year Selector */}
                    {getAvailableYears().length > 0 && (
                        <div className="flex flex-col gap-2">
                            <label htmlFor="yearSelect" className="text-sm font-medium text-gray-700">
                                Select Academic Year
                            </label>
                            <select
                                id="yearSelect"
                                value={admissionYear}
                                onChange={(e) => setAdmissionYear(parseInt(e.target.value))}
                                className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-800 font-medium hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            >
                                {getAvailableYears().map((year) => (
                                    <option key={year} value={year}>
                                        {year}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
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

            {/* No Results Found */}
            {!isLoading && yearResults.length === 0 && (
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
                        Admission results for {admissionYear} have not been published yet. Please check back later.
                    </p>
                </div>
            )}

            {/* Results Grid */}
            {!isLoading && yearResults.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {classes.map((classNum) => {
                        const result = yearResults.find((r) => r.class_name === classNum);
                        const isAvailable = result && hasAnyList(result);

                        return (
                            <div
                                key={classNum}
                                className={`bg-white border rounded-lg shadow-md overflow-hidden transition-all ${isAvailable
                                    ? "border-blue-200 hover:shadow-xl"
                                    : "border-gray-200 opacity-75"
                                    }`}
                            >
                                <div
                                    className={`p-6 ${isAvailable
                                        ? "bg-linear-to-r from-blue-600 to-blue-700"
                                        : "bg-gray-100"
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h2
                                                className={`text-2xl font-bold ${isAvailable ? "text-white" : "text-gray-700"
                                                    }`}
                                            >
                                                Class {classNum}
                                            </h2>
                                            <p
                                                className={`text-sm mt-1 ${isAvailable ? "text-blue-100" : "text-gray-500"
                                                    }`}
                                            >
                                                Admission {admissionYear}
                                            </p>
                                        </div>
                                        <div
                                            className={`text-3xl font-bold ${isAvailable ? "text-white" : "text-gray-400"
                                                }`}
                                        >
                                            {classNum}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6">
                                    {isAvailable && result ? (
                                        <>
                                            <div className="mb-4">
                                                <div className="flex items-center gap-2 text-green-600 mb-2">
                                                    <svg
                                                        className="h-5 w-5"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                    >
                                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                                    </svg>
                                                    <span className="font-semibold">Result Published</span>
                                                </div>
                                                <p className="text-xl font-bold text-gray-600">
                                                    {getAvailableListsCount(result)} list(s) available
                                                </p>
                                                {/* <p className="text-sm text-gray-500 mt-1">
                                                    Published: {new Date(result.created_at).toLocaleDateString()}
                                                </p> */}
                                            </div>

                                            <Link
                                                to={`/admission/result/${classNum}`}
                                                className="block w-full text-center px-4 py-3 bg-blue-600 text-white! font-medium rounded-md hover:bg-blue-700 transition-colors"                                            >
                                                View Results
                                            </Link>
                                        </>
                                    ) : (
                                        <div className="text-center py-4">
                                            <div className="flex items-center justify-center gap-2 text-gray-400 mb-2">
                                                <svg
                                                    className="h-5 w-5"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                >
                                                    <circle cx="12" cy="12" r="10"></circle>
                                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                                </svg>
                                                <span className="font-semibold">Not Published</span>
                                            </div>
                                            <p className="text-sm text-gray-500">
                                                Results will be available soon
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Information Section */}
            {!isLoading && yearResults.length > 0 && (
                <div className="mt-10 bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
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
                        Important Information
                    </h3>
                    <ul className="space-y-3 text-sm text-blue-900">
                        <li className="flex items-start gap-2">
                            <span className="text-blue-600 font-bold mt-0.5">•</span>
                            <span>
                                Click on "View Results" to see the 1st Result List and waiting lists for each class.
                            </span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-600 font-bold mt-0.5">•</span>
                            <span>
                                Results are published as PDF documents which you can view and download.
                            </span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-600 font-bold mt-0.5">•</span>
                            <span>
                                If you are on a waiting list, you will be contacted if a seat becomes available.
                            </span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-600 font-bold mt-0.5">•</span>
                            <span>
                                For any queries regarding admission results, please contact the school administration.
                            </span>
                        </li>
                    </ul>
                </div>
            )}
        </div>
    );
}

export default AdmissionResultList;
