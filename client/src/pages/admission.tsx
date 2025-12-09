import { useEffect, useState } from 'react'
import axios from 'axios'

interface AdmissionData {
    preview_url: string
    download_url: string
}

function Admission() {
    const [admissionData, setAdmissionData] = useState<AdmissionData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchAdmissionData()
    }, [])

    const fetchAdmissionData = async () => {
        try {
            setLoading(true)
            const response = await axios.get('/api/admission')

            if (response.data) {
                const data = response.data as AdmissionData | null
                setAdmissionData(data)
            } else {
                setError(response.data.message || 'Failed to fetch admission data')
            }
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                setError(err.response?.data?.message || err.message || 'Network error occurred')
            } else if (err instanceof Error) {
                setError(err.message)
            } else {
                setError('Network error occurred')
            }
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading admission information...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="text-red-500 text-xl mb-4">⚠️ Error</div>
                    <p className="text-gray-600">{error}</p>
                    <button
                        onClick={fetchAdmissionData}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">
                        Admission Notice
                    </h1>




                    {admissionData ? (
                        <div className="mb-6">
                            <div className="border rounded-lg overflow-hidden">
                                <iframe
                                    src={`${admissionData.preview_url}#navpanes=0&scrollbar=0`}
                                    className="w-full h-250"
                                    title="Admission Notice"
                                />
                            </div>
                            <div className="mt-2 text-center">
                                <a
                                    href={admissionData.download_url}
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

                    {/* <div className="text-center mt-8">
                        {admissionData?.reg_open ? (
                            <button
                                onClick={() => {
                                    window.location.href = '/admission/form'
                                }}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg transition-colors duration-200 text-lg"
                            >
                                Proceed to Admission Form
                            </button>
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
                    </div> */}
                </div>
            </div>
        </div>
    )
}

export default Admission
