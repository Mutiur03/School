import { useEffect } from 'react'
import axios from 'axios'
import { getFileUrl } from '@/lib/backend'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

interface Class8RegData {
    id: number
    a_sec_roll: string | null
    b_sec_roll: string | null
    reg_open: boolean
    instruction_for_a: string | null
    instruction_for_b: string | null
    attachment_instruction: string | null
    notice: string | null
    class8_year: number | null
}

function RegClass8() {
    useEffect(() => {
        document.title = "Class Eight Registration Notice";
    }, []);

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['reg-class-8-settings'],
        queryFn: () => axios.get(`/api/reg/class-8`).then(res => res.data.data),
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
                    <p className="text-gray-600">{error.message}</p>
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

    const noticeUrl = data?.notice ? getFileUrl(data.notice) : null;
    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">
                        Class Eight Registration Notice
                    </h1>

                    <div className="text-center mb-6">
                        <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                            Academic Year: {data?.class8_year || new Date().getFullYear()}
                        </span>
                    </div>

                    {noticeUrl ? (
                        <div className="mb-6">
                            <div className="border rounded-lg overflow-hidden">
                                <iframe
                                    src={`${noticeUrl}#navpanes=0&scrollbar=0`}
                                    className="w-full h-250"
                                    title="Class Eight Registration Notice"
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
                        {data?.reg_open ? (
                            <Link
                                to="/registration/class-8/form"
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

export default RegClass8
