import { getAdmissionData } from "@/queries/admission.queries"

async function pages() {
    const { preview_url, download_url } = await getAdmissionData()
    return (
        <div className="min-h-screen bg-gray-50 py-8">
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
                </div>
            </div>
        </div>
    )
}

export default pages
