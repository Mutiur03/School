import { useEffect } from 'react'
import axios from 'axios'
import { getFileUrl } from '@/lib/backend'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

interface Class9RegData {
    id: number
    a_sec_roll: string | null
    b_sec_roll: string | null
    class9_year: number | null
    reg_open: boolean
    instructions: string | null
    notice: string | null
    created_at: string
    updated_at: string
}

function RegClass9() {
    useEffect(() => {
        document.title = "Class Nine Registration Notice";
    }, []);

    const { data: regData, isLoading, error, refetch } = useQuery({
        queryKey: ['reg-class9-settings'],
        queryFn: () => axios.get('/api/reg/class-9').then(res => res.data.data),
    })

    if (isLoading) {
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
                    <p className="text-gray-600">Failed to fetch registration data</p>
                    <button
                        onClick={() => refetch()}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    const noticeUrl = regData?.notice ? getFileUrl(regData.notice) : null;

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">
                        SSC Registration Notice
                    </h1>

                    {regData?.class9_year && (
                        <div className="text-center mb-6">
                            <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                                Academic Year: {regData.class9_year}
                            </span>
                        </div>
                    )}

                    {noticeUrl ? (
                        <div className="mb-6">
                            <div className="border rounded-lg overflow-hidden">
                                <iframe
                                    src={`${noticeUrl}#navpanes=0&scrollbar=0`}
                                    className="w-full h-250"
                                    title="Class Nine Registration Notice"
                                />
                            </div>
                            <div className="mt-2 text-center">
                                <a
                                    href={noticeUrl}
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
                            <Link
                                to="/registration/class-9/form"
                                className="bg-green-600 hover:bg-green-700 text-white! font-bold py-3 px-8 rounded-lg transition-colors duration-200 text-lg"
                            >
                                Proceed to Registration Form
                            </Link>
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

export default RegClass9
