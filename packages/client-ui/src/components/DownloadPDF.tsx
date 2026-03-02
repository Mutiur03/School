import { useSchoolConfig } from "@/context/school";

type DownloadPDFProps = {
    title1?: string;
    title2?: string;
    handleDownloadPDF: () => void;
    downloadingPDF: boolean;
};

function DownloadPDF({
    title1,
    title2,
    handleDownloadPDF,
    downloadingPDF,
}: DownloadPDFProps) {
    const schuleConfig = useSchoolConfig();
    const phone = schuleConfig.contact.phone;
    const email = schuleConfig.contact.email;
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
                                ></path>
                            </svg>
                        </div>
                    </div>
                    <h1 className="text-4xl font-bold mb-3">{title1}</h1>
                    <p className="text-xl">
                        Your application has been successfully submitted
                    </p>
                </div>

                <div className="bg-white shadow rounded-b overflow-hidden">
                    <div className="p-8 space-y-8">
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center p-3 bg-gray-100 rounded-full mb-4">
                                <svg
                                    className="w-8 h-8 text-gray-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                    />
                                </svg>
                            </div>
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
                                className={`px-8 py-4 rounded font-semibold text-lg transition-all duration-300 shadow ${downloadingPDF
                                    ? "bg-gray-300 cursor-not-allowed text-gray-500"
                                    : "bg-gray-700 text-white hover:bg-gray-800"
                                    }`}
                            >
                                {downloadingPDF ? (
                                    <div className="flex items-center space-x-3">
                                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-400 border-t-transparent"></div>
                                        <span>Generating PDF...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center space-x-3">
                                        <svg
                                            className="w-6 h-6"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                            />
                                        </svg>
                                        <span>Download PDF</span>
                                    </div>
                                )}
                            </button>
                        </div>

                        <div className="grid md:grid-cols-1 gap-6">
                            <div className="bg-gray-50 border border-gray-200 p-6 rounded">
                                <div className="flex items-start space-x-3">
                                    <div className="shrink-0">
                                        <svg
                                            className="w-6 h-6 text-gray-600"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                            />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-800 text-lg mb-2">
                                            Contact Information
                                        </h3>
                                        <div className="space-y-2 text-gray-600">
                                            <p className="flex items-center space-x-2">
                                                <span className="font-medium">Phone:</span>{" "}
                                                <span>{phone}</span>
                                                <span>(Headmaster)</span>
                                            </p>
                                            <p className="flex items-center space-x-2">
                                                <span className="font-medium">Email:</span>{" "}
                                                <span>{email}</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DownloadPDF;
