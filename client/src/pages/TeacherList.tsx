import  { useState, useEffect, useRef } from 'react'
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
    const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null)
    const [isOpen, setIsOpen] = useState(false)
    const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

    // new state for loading
    const [isLoading, setIsLoading] = useState(false)
    const host = (import.meta && (import.meta).env?.VITE_BACKEND_URL) || ''

    useEffect(() => {
        // fetch teachers from backend
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

    // close modal on Escape
    useEffect(() => {
        if (!selectedTeacher) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeDetails()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTeacher])

    const openDetails = (t: Teacher) => {
        // mount modal with data
        setSelectedTeacher(t)
        // allow DOM to mount, then trigger enter animation
        // small timeout ensures classes transition
        setTimeout(() => setIsOpen(true), 20)
    }

    const closeDetails = () => {
        // trigger exit animation
        setIsOpen(false)
        // clear previous timeout if any
        if (closeTimeout.current) clearTimeout(closeTimeout.current)
        // after animation duration, unmount modal
        closeTimeout.current = setTimeout(() => {
            setSelectedTeacher(null)
            closeTimeout.current = null
        }, 220) // match duration below (200)
    }

    useEffect(() => {
        return () => {
            if (closeTimeout.current) clearTimeout(closeTimeout.current)
        }
    }, [])

    // filtered list similar to admin
    const filteredTeachers = teachers
        .filter((t) => (t.available === undefined ? true : !!t.available))
        .sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0))

    return (
        <div className=" text-gray-800">
            <h1 className="text-3xl font-serif mb-4">Teacher List</h1>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                    <thead className="bg-gray-50">
                        <tr className="divide-x divide-gray-200">
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SL</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NAME</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DESIGNATION</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {isLoading ? (
                            <tr>
                                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-600">
                                    Loading teachers...
                                </td>
                            </tr>
                        ) : filteredTeachers.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-600">
                                    No teachers found.
                                </td>
                            </tr>
                        ) : (
                            filteredTeachers.map((t, i) => (
                                <tr key={t.id} className={i % 2 === 0 ? 'bg-white divide-x divide-gray-200' : 'bg-gray-50 divide-x divide-gray-200'}>
                                    <td className="px-4 py-3 text-sm text-left w-16">{i + 1}</td>
                                    <td className="px-4 py-3 text-sm font-serif uppercase tracking-wide">{t.name}</td>
                                    <td className="px-4 py-3 text-sm w-56">{t.designation || '—'}</td>
                                    <td className="px-4 py-3 text-sm">
                                        <button
                                            onClick={() => openDetails(t)}
                                            className="text-pink-500 hover:underline font-medium"
                                        >
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {selectedTeacher && (
                <div
                    className={`fixed inset-0 flex items-center justify-center z-50 ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Details for ${selectedTeacher.name}`}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closeDetails()
                    }}
                >
                    <div
                        className={`absolute inset-0 bg-black transition-opacity duration-200 ${isOpen ? 'opacity-50' : 'opacity-0'}`}
                        aria-hidden="true"
                    />

                    <div
                        className={`relative bg-white rounded-lg shadow-lg max-w-md w-full mx-4 overflow-hidden transform transition-all duration-200 ease-out
							${isOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}
                    >
                        <div className="flex justify-between items-center p-4 border-b">
                            <h2 className="text-lg font-semibold">{selectedTeacher.name}</h2>
                            <button
                                onClick={closeDetails}
                                className="text-gray-500 hover:text-gray-700 px-2 py-1"
                                aria-label="Close details"
                            >
                                ×
                            </button>
                        </div>
                        <div className="p-4">
                            <div className="flex justify-center mb-4">
                                {selectedTeacher.image ? (
                                    <img
                                        src={selectedTeacher.image.startsWith('http') ? selectedTeacher.image : `${host}/${selectedTeacher.image}`}
                                        alt={selectedTeacher.name}
                                        className="w-48 h-48 object-cover rounded"
                                    />
                                ) : (
                                    <div className="w-48 h-48 bg-gray-100 flex items-center justify-center rounded text-gray-400">
                                        No image
                                    </div>
                                )}
                            </div>
                            <p className="text-sm"><strong>Email:</strong> {selectedTeacher.email || '—'}</p>
                            <p className="text-sm"><strong>Phone:</strong> {selectedTeacher.phone || '—'}</p>
                            <p className="text-sm"><strong>Designation:</strong> {selectedTeacher.designation || '—'}</p>
                            <p className="text-sm"><strong>Address:</strong> {selectedTeacher.address || '—'}</p>
                        </div>
                        <div className="p-4 border-t flex justify-end">
                            <button onClick={closeDetails} className="px-4 py-2 bg-pink-500 text-white rounded hover:bg-pink-600">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default TeacherList
