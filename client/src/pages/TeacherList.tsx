import { useState, useEffect } from 'react'
import axios from 'axios'

function TeacherList() {
    useEffect(() => {
        document.title = "Teacher List";
    }, []);

    type Teacher = {
        id: number
        name: string
        designation?: string
        email?: string
        phone?: string
        address?: string
        subject?: string
        image?: string
        available?: boolean
    }

    const [teachers, setTeachers] = useState<Teacher[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const host = import.meta.env?.VITE_BACKEND_URL;

    useEffect(() => {
        const fetchTeachers = async () => {
            setIsLoading(true)
            try {
                const res = await axios.get('/api/teachers/getTeachers')
                const data = res?.data?.data || []
                setTeachers(Array.isArray(data) ? data : [])
            } catch (err) {
                console.error('Failed to fetch teachers:', err)
                setTeachers([])
            } finally {
                setIsLoading(false)
            }
        }

        fetchTeachers()
    }, [])

    const filteredTeachers = teachers
        .filter((t) => (t.available === undefined ? true : !!t.available))
        .sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0))

    return (
        <div className="text-gray-800 p-4 sm:p-6 lg:p-8">
            <h1 className="text-2xl sm:text-3xl text-center font-serif mb-4 sm:mb-6">Teacher List</h1>

            <div className="hidden lg:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50">
                        <tr className="divide-x divide-gray-200">
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Image</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Name & Email</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Contact Details</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {isLoading ? (
                            <tr>
                                <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-600">
                                    Loading teachers...
                                </td>
                            </tr>
                        ) : filteredTeachers.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-600">
                                    No teachers found.
                                </td>
                            </tr>
                        ) : (
                            filteredTeachers.map((t, i) => (
                                <tr key={t.id} className={i % 2 === 0 ? 'bg-white divide-x divide-gray-200' : 'bg-gray-50 divide-x divide-gray-200'}>
                                    <td className="px-4 py-3 text-sm w-32 align-top">
                                        {t.image ? (
                                            <img
                                                src={t.image.startsWith('http') ? t.image : `${host}/${t.image}`}
                                                alt={t.name}
                                                className="w-20 h-20 object-cover rounded border border-gray-200"
                                            />
                                        ) : (
                                            <div className="w-20 h-20 bg-gray-100 flex items-center justify-center rounded border border-gray-200 text-gray-400 text-xs">
                                                No Image
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-serif tracking-wide align-top">
                                        <div className="font-semibold text-lg">{t.name}</div>
                                        <div className="mt-2">
                                            {t.designation && (
                                                <div className="text-sm text-gray-600 mt-1">Designation: {t.designation}</div>
                                            )}
                                        </div>
                                        <div className="mt-2">
                                            <span className="font-medium text-gray-600">Email:</span> {t.email || '—'}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm align-top">
                                        <div className="space-y-2">
                                            <div><span className="font-medium text-gray-600">Phone:</span> {t.phone || '—'}</div>
                                            <div><span className="font-medium text-gray-600">Address:</span> {t.address || '—'}</div>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="lg:hidden">
                {isLoading ? (
                    <div className="text-center py-8 text-gray-600">
                        Loading teachers...
                    </div>
                ) : filteredTeachers.length === 0 ? (
                    <div className="text-center py-8 text-gray-600">
                        No teachers found.
                    </div>
                ) : (
                    <div className="space-y-4 sm:space-y-6">
                        {filteredTeachers.map((t) => (
                            <div key={t.id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 sm:p-6">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:space-x-4 space-y-4 sm:space-y-0">
                                    <div className="shrink-0 self-center sm:self-start">
                                        {t.image ? (
                                            <img
                                                src={t.image.startsWith('http') ? t.image : `${host}/${t.image}`}
                                                alt={t.name}
                                                className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded border border-gray-200"
                                            />
                                        ) : (
                                            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 flex items-center justify-center rounded border border-gray-200 text-gray-400 text-xs">
                                                No Image
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="mb-3">
                                            <h3 className="text-lg sm:text-xl font-serif tracking-wide font-semibold text-gray-900 wrap-break-word">
                                                {t.name}
                                            </h3>
                                            {t.designation && (
                                                <p className="text-sm text-gray-600 mt-1">{t.designation}</p>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                            <div>
                                                <span className="block text-xs font-medium text-gray-500 tracking-wider mb-1">Email</span>
                                                <p className="text-sm text-gray-900 break-all">{t.email || '—'}</p>
                                            </div>

                                            <div>
                                                <span className="block text-xs font-medium text-gray-500 tracking-wider mb-1">Phone</span>
                                                <p className="text-sm text-gray-900">{t.phone || '—'}</p>
                                            </div>

                                            <div className="sm:col-span-2">
                                                <span className="block text-xs font-medium text-gray-500 tracking-wider mb-1">Address</span>
                                                <p className="text-sm text-gray-900 wrap-break-word">{t.address || '—'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default TeacherList
