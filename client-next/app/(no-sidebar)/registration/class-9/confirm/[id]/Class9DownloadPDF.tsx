"use client";

import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import type { SchoolConfig } from "@/types";
import type { Class9RegistrationRecord } from "@school/shared-schemas";

type Class9DownloadPDFProps = {
    title1?: string;
    title2?: string;
    schoolConfig: SchoolConfig;
    registration: Class9RegistrationRecord;
    pdfUrl: string;
};

export default function Class9DownloadPDF({
    title1 = "Registration Confirmed!",
    title2 = "Download Your SSC Registration Form",
    schoolConfig,
    registration,
    pdfUrl,
}: Class9DownloadPDFProps) {
    const [downloadingPDF, setDownloadingPDF] = useState(false);

    const handleDownloadPDF = async () => {
        try {
            setDownloadingPDF(true);
            const response = await axios.get(pdfUrl, { responseType: "blob" });
            const blob = new Blob([response.data], { type: "application/pdf" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Class_9_Registration_${registration.student_name_en?.replace(/\s+/g, "_") || registration.roll}.pdf`;
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
                            <p className="text-gray-600 mb-6">
                                Click the button below to download your registration
                                form as a PDF.
                            </p>
                            <button
                                onClick={handleDownloadPDF}
                                disabled={downloadingPDF}
                                className={`px-8 py-4 rounded-lg font-bold text-lg text-white transition-all ${
                                    downloadingPDF
                                        ? "bg-gray-400 cursor-not-allowed"
                                        : "bg-blue-600 hover:bg-blue-700"
                                }`}
                            >
                                {downloadingPDF ? "Downloading..." : "Download PDF"}
                            </button>
                        </div>

                        {(phone || email) && (
                            <div className="text-center text-sm text-gray-500 border-t pt-6">
                                <p>Need help? Contact the school office:</p>
                                {phone ? <p>Phone: {phone}</p> : null}
                                {email ? <p>Email: {email}</p> : null}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
