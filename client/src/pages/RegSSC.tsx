import { useEffect, useState } from 'react'
import axios from 'axios'

interface SSCRegData {
    id: number
    a_sec_roll: string | null
    b_sec_roll: string | null
    ssc_year: number | null
    reg_open: boolean
    instructions: string | null
    notice: string | null
    created_at: string
    updated_at: string
}

function RegSSC() {
    useEffect(() => {
        document.title = "SSC Registration Notice";
    }, []);
    const [regData, setRegData] = useState<SSCRegData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchRegData()
    }, [])

    const fetchRegData = async () => {
        try {
            setLoading(true)
            const response = await axios.get('/api/reg/ssc')

            if (response.data.success) {
                setRegData(response.data.data)
            } else {
                setError(response.data.message || 'Failed to fetch registration data')
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
                    <p className="mt-4 text-gray-600">Loading registration information...</p>
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
                        onClick={fetchRegData}
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
                        SSC Registration Notice
                    </h1>

                    {regData?.ssc_year && (
                        <div className="text-center mb-6">
                            <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                                SSC Batch: {regData.ssc_year}
                            </span>
                        </div>
                    )}

                    {regData?.notice ? (
                        <div className="mb-6">
                            <div className="border rounded-lg overflow-hidden">
                                <iframe
                                    src={`${regData.notice}#navpanes=0&scrollbar=0`}
                                    className="w-full h-150"
                                    title="SSC Registration Notice"
                                />
                            </div>
                            <div className="mt-2 text-center">
                                <a
                                    href={regData.notice}
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
                            <p>No registration notice available</p>
                        </div>
                    )}

                    <div className="text-center mt-8">
                        {regData?.reg_open ? (
                            <button
                                onClick={()=>{
                                    window.location.href = '/registration/ssc'
                                }}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg transition-colors duration-200 text-lg"
                            >
                                Proceed to Registration Form
                            </button>
                        ) : (
                            <div className="text-center">
                                <button
                                    disabled
                                    className="bg-gray-400 text-white font-bold py-3 px-8 rounded-lg cursor-not-allowed text-lg"
                                >
                                    Registration Closed
                                </button>
                                <p className="mt-2 text-sm text-gray-600">
                                    Registration is currently not available
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default RegSSC
