import { getAdmissionData } from "@/queries/admission.queries"
import Link from "next/link"

async function AdmissionFormNotice() {
    const { preview_url, download_url, admission_open } = await getAdmissionData()
    return (
        <div className="max-w-4xl mx-auto px-4">
            <div className="bg-white rounded-lg shadow-md p-6">
                <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">
                    Admission Notice
                </h1>
                {preview_url ? (
                    <div className="mb-6">
                        <div className="border rounded-lg overflow-hidden">
                            <iframe
                                src={`${preview_url}#navpanes=0&scrollbar=0`}
                                className="w-full h-250"
                                title="Admission Notice"
                            />
                        </div>
                        <div className="mt-2 text-center">
                            <a
                                href={download_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline text-sm"
                            >
                                Open in new tab / Download
                            </a>
                        </div>
                    </div>
                ) : (
                    <div className="mb-6 text-center py-8 text-gray-500">
                        <div className="text-4xl mb-2">📄</div>
                        <p>No admission notice available</p>
                    </div>
                )}

                <div className="text-center mt-8">
                    {admission_open ? (
                        <Link
                            href="/admission/form"
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg transition-colors duration-200 text-lg"
                        >
                            Proceed to Admission Form
                        </Link>
                    ) : (
                        <div className="text-center">
                            <button
                                disabled
                                className="bg-gray-400 text-white font-bold py-3 px-8 rounded-lg cursor-not-allowed text-lg"
                            >
                                Admission Closed
                            </button>
                            <p className="mt-2 text-sm text-gray-600">
                                Admission is currently not available
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default AdmissionFormNotice
