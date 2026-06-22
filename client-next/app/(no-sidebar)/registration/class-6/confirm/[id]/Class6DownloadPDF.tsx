"use client";

import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import type { SchoolConfig } from "@/types";
import type { Class6RegistrationRecord } from "@school/shared-schemas";

type Class6DownloadPDFProps = {
    title1?: string;
    title2?: string;
    schoolConfig: SchoolConfig;
    registration: Class6RegistrationRecord;
    pdfUrl: string;
};

export default function Class6DownloadPDF({
    title1 = "Registration Confirmed!",
    title2 = "Download Your Registration Form",
    schoolConfig,
    registration,
    pdfUrl,
}: Class6DownloadPDFProps) {
    const [downloadingPDF, setDownloadingPDF] = useState(false);

    const handleDownloadPDF = async () => {
        try {
            setDownloadingPDF(true);
            const response = await axios.get(pdfUrl, { responseType: "blob" });
            const blob = new Blob([response.data], { type: "application/pdf" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Class6_Reg_${registration.student_name_en?.replace(/\s+/g, "_")}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            toast.error("Failed to download PDF");
        } finally {
            setDownloadingPDF(false);
        }
    };

    const phone = schoolConfig?.contact?.phone;
    const email = schoolConfig?.contact?.email;

    return (
        <div className="min-h-screen bg-gray-100 py-8 px-4">
            <div className="max-w-4xl mx-auto animate-fade-in">
                <div className="bg-gray-800 text-white p-8 text-center rounded-t">
                    <div className="mb-6">
                        <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-white">
                            <svg
                                className="w-12 h-12 text-gray-800"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M5 13l4 4L19 7"
                                />
                            </svg>
                        </div>
                    </div>
                    <h1 className="text-4xl font-bold mb-3">{title1}</h1>
                    <p className="text-xl">
                        Your registration has been successfully submitted
                    </p>
                </div>

                <div className="bg-white shadow rounded-b overflow-hidden">
                    <div className="p-8 space-y-8">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">
                                {title2}
                            </h2>
                            <p className="text-gray-600 text-lg mb-6">
                                Download the PDF document and follow the instructions for the
                                next steps.
                            </p>
                        </div>

                        <div className="flex justify-center">
                            <button
                                onClick={handleDownloadPDF}
                                disabled={downloadingPDF}
                                className={`px-8 py-4 rounded font-semibold text-lg transition-all duration-300 shadow ${
                                    downloadingPDF
                                        ? "bg-gray-300 cursor-not-allowed text-gray-500"
                                        : "bg-gray-700 text-white hover:bg-gray-800"
                                }`}
                            >
                                {downloadingPDF ? "Generating PDF..." : "Download PDF"}
                            </button>
                        </div>

                        <div className="bg-gray-50 border border-gray-200 p-6 rounded">
                            <h3 className="font-bold text-gray-800 text-lg mb-2">
                                Contact Information
                            </h3>
                            <div className="space-y-2 text-gray-600">
                                <p>
                                    <span className="font-medium">Phone:</span> {phone}
                                </p>
                                <p>
                                    <span className="font-medium">Email:</span> {email}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
