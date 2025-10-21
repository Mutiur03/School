import { useState, useEffect, useRef } from 'react'

function StaffList() {
    type StaffMember = {
        id: number
        name: string
        designation: string
        image?: string
        email?: string
        phone?: string
        address?: string
    }

    const [staff, setStaff] = useState<StaffMember[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
    const [isOpen, setIsOpen] = useState(false)
    const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        const controller = new AbortController()
        const host = (import.meta).env?.VITE_BACKEND_URL || window.location.origin

        const load = async () => {
            setLoading(true)
            setError(null)
            try {
                const res = await fetch(`${host}/api/staffs`, { signal: controller.signal })
                if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`)
                const json = await res.json()
                // support responses that wrap data in { data: [...] } or return array directly
                const items = (json && json.data) ? json.data : json
                const mapped: StaffMember[] = (Array.isArray(items) ? items : []).map((it, idx: number) => {
                    const image = it?.image
                    let imageUrl: string | undefined = undefined
                    if (image) {
                        imageUrl = /^https?:\/\//i.test(image) ? image : `${host}/${image.replace(/^\/+/, '')}`
                    }
                    return {
                        id: it.id ?? idx + 1,
                        name: it.name ?? it.fullname ?? `Staff Member ${idx + 1}`,
                        designation: it.designation ?? 'Senior Teacher',
                        image: imageUrl,
                        email: it.email ?? it?.contact?.email,
                        phone: it.phone ?? it?.contact?.phone,
                        address: it.address ?? it?.homeTown ?? it?.location
                    }
                })
                setStaff(mapped)
            } catch (err) {
                console.error('Error loading staff', err)
                setError('Failed to load staff.')

            } finally {
                setLoading(false)
            }
        }
        load()
        return () => controller.abort()
    }, [])

    // close modal on Escape
    useEffect(() => {
        if (!selectedStaff) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeStaffDetails()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [selectedStaff])

    const openStaffDetails = (s: StaffMember) => {
        // mount modal with data
        setSelectedStaff(s)
        // allow DOM to mount, then trigger enter animation
        // small timeout ensures classes transition
        setTimeout(() => setIsOpen(true), 20)
    }

    const closeStaffDetails = () => {
        // trigger exit animation
        setIsOpen(false)
        // clear previous timeout if any
        if (closeTimeout.current) clearTimeout(closeTimeout.current)
        // after animation duration, unmount modal
        closeTimeout.current = setTimeout(() => {
            setSelectedStaff(null)
            closeTimeout.current = null
        }, 220) // match duration below (200)
    }

    useEffect(() => {
        return () => {
            if (closeTimeout.current) clearTimeout(closeTimeout.current)
        }
    }, [])

    return (
        <div className=" text-gray-800">
            <h1 className="text-3xl font-serif mb-4">Staff List</h1>

            <div className="overflow-x-auto">
                {error && <div className="text-red-600 mb-2">{error}</div>}
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                    <thead className="bg-gray-50">
                        <tr className="divide-x divide-gray-200">
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SL No</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NAME</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DESIGNATION</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DETAILS</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr>
                                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">Loading staff...</td>
                            </tr>
                        ) : staff.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">No staff found.</td>
                            </tr>
                        ) : (
                            staff.map((s, i) => (
                                <tr key={s.id} className={i % 2 === 0 ? 'bg-white divide-x divide-gray-200' : 'bg-gray-50 divide-x divide-gray-200'}>
                                    <td className="px-4 py-3 text-sm text-left w-16">{i + 1}</td>
                                    <td className="px-4 py-3 text-sm font-serif uppercase tracking-wide">{s.name}</td>
                                    <td className="px-4 py-3 text-sm w-56">{s.designation}</td>
                                    <td className="px-4 py-3 text-sm">
                                        <a
                                            href="#"
                                            className="text-pink-500 hover:underline font-medium"
                                            onClick={(e) => {
                                                e.preventDefault()
                                                openStaffDetails(s)
                                            }}
                                        >
                                            See Details
                                        </a>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal: keep it mounted only when selectedStaff != null, but animate with isOpen */}
            {selectedStaff && (
                <div
                    className={`fixed inset-0 flex items-center justify-center z-50 ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Details for ${selectedStaff.name}`}
                    onClick={(e) => {
                        // close when clicking the overlay (but not when clicking modal content)
                        if (e.target === e.currentTarget) closeStaffDetails()
                    }}
                >
                    {/* overlay with fade */}
                    <div
                        className={`absolute inset-0 bg-black transition-opacity duration-200 ${isOpen ? 'opacity-50' : 'opacity-0'}`}
                        aria-hidden="true"
                    />

                    {/* modal panel with scale + translate + fade */}
                    <div
                        className={`relative bg-white rounded-lg shadow-lg max-w-md w-full mx-4 overflow-hidden transform transition-all duration-200 ease-out
                            ${isOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}
                    >
                        <div className="flex justify-between items-center p-4 border-b">
                            <h2 className="text-lg font-semibold">{selectedStaff.name}</h2>
                            <button
                                onClick={closeStaffDetails}
                                className="text-gray-500 hover:text-gray-700 px-2 py-1"
                                aria-label="Close details"
                            >
                                ×
                            </button>
                        </div>
                        <div className="p-4">
                            {/* image */}
                            <div className="flex justify-center mb-4">
                                <img
                                    src={selectedStaff.image}
                                    alt={selectedStaff.name}
                                    className="w-48 h-48 object-cover rounded"
                                />
                            </div>
                            {/* details */}
                            <div className="space-y-2 text-sm">
                                <p><strong>Designation:</strong> {selectedStaff.designation}</p>
                                {selectedStaff.email && <p><strong>Email:</strong> {selectedStaff.email}</p>}
                                {selectedStaff.phone && <p><strong>Phone:</strong> {selectedStaff.phone}</p>}
                                {selectedStaff.address && <p><strong>Address:</strong> {selectedStaff.address}</p>}
                            </div>
                            {/* add other details here as needed */}
                        </div>
                        <div className="p-4 border-t flex justify-end">
                            <button onClick={closeStaffDetails} className="px-4 py-2 bg-pink-500 text-white rounded hover:bg-pink-600">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default StaffList
