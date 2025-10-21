import { useEffect, useState, useRef } from 'react'
import axios from 'axios'
import { useParams, Link } from 'react-router-dom'

interface ImageItem {
    id: number | string
    image_path: string
    caption?: string
}

function Images() {
    const { type, id } = useParams<{ type: 'campus' | 'event'; id: string }>()

    const host = import.meta.env.VITE_BACKEND_URL
    const [images, setImages] = useState<ImageItem[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // replaced selected image object with selectedIndex
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

    // ref to the active thumbnail button so we can center it in the strip
    const activeThumbRef = useRef<HTMLButtonElement | null>(null)

    // copy (clone) indicator state
    const [copied, setCopied] = useState(false)

    // copy current full image URL to clipboard (used by "clone" icon)
    const copyImage = async () => {
        if (selectedIndex === null) return
        const url = images[selectedIndex].image_path ? `${host}/${images[selectedIndex].image_path}` : ''
        try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        } catch (err) {
            console.error('Copy failed', err)
        }
    }

    useEffect(() => {
        if (!type || !id) return

        setLoading(true)
        setError(null)

        // choose endpoint based on gallery type
        const endpoint =
            type === 'campus'
                ? `/api/gallery/getGalleries/campus/${id}`
                : `/api/gallery/getGalleries/event/${id}`

        axios
            .get(endpoint)
            .then((res) => {
                console.log(res.data);

                const data = Array.isArray(res.data) ? res.data : []
                setImages(data)
            })
            .catch((err) => {
                console.error('Failed to load images:', err)
                setError(err?.message ?? 'Failed to load images')
            })
            .finally(() => setLoading(false))
    }, [type, id])

    // keyboard navigation when modal open
    useEffect(() => {
        if (selectedIndex === null) return

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setSelectedIndex(null)
            } else if (e.key === 'ArrowLeft') {
                setSelectedIndex((prev) => {
                    if (prev === null) return null
                    return (prev - 1 + images.length) % images.length
                })
            } else if (e.key === 'ArrowRight') {
                setSelectedIndex((prev) => {
                    if (prev === null) return null
                    return (prev + 1) % images.length
                })
            }
        }

        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [selectedIndex, images.length])

    // when the selection changes, center the active thumbnail in the strip
    useEffect(() => {
        if (selectedIndex === null) return
        // scroll the active thumbnail into view centered horizontally
        activeThumbRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }, [selectedIndex])

    const goPrev = () => {
        setSelectedIndex((prev) => {
            if (prev === null) return null
            return (prev - 1 + images.length) % images.length
        })
    }

    const goNext = () => {
        setSelectedIndex((prev) => {
            if (prev === null) return null
            return (prev + 1) % images.length
        })
    }

    return (
        <div className="p-4">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                    {type === 'campus' ? 'Campus Gallery' : 'Event Gallery'}
                </h2>
                <Link to="/gallery" className="text-sm text-blue-600">
                    Back to galleries
                </Link>
            </div>

            {loading ? (
                <div className="text-center py-8 text-gray-500">Loading images...</div>
            ) : error ? (
                <div className="text-center py-8 text-red-500">{error}</div>
            ) : images.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No images to show.</div>
            ) : (
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {images.map((img, idx) => (
                        <button
                            key={img.id}
                            onClick={() => setSelectedIndex(idx)}
                            className="block rounded overflow-hidden bg-white border border-gray-100 hover:shadow-md focus:outline-none"
                        >
                            <img
                                src={img.image_path ? `${host}/${img.image_path}` : '/placeholder.svg'}
                                alt={img.caption || 'image'}
                                className="w-full h-36 object-cover block"
                            />
                        </button>
                    ))}
                </div>
            )}

            {/* modal slider */}
            {selectedIndex !== null && images[selectedIndex] && (
                <div
                    className="fixed inset-0  bg-opacity-60 flex items-center justify-center z-50 p-4"
                    onClick={() => setSelectedIndex(null)}
                    style={{ backdropFilter: 'blur(6px)' }} // blur background behind the overlay
                >
                    {/* styles for hiding scrollbar and thumbnail brightness */}
                    <style>{`
                        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                        .no-scrollbar::-webkit-scrollbar { display: none; }
                    `}</style>

                    <div
                        className="max-w-4xl w-full  max-h-full rounded-sm bg-white  p-4 flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                {/* Close (X) icon */}
                                <button
                                    onClick={() => setSelectedIndex(null)}
                                    aria-label="Close"
                                    className="text-white bg-black p-2 rounded-full hover:bg-black/80"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>

                                {/* Clone / copy icon */}
                                <button
                                    onClick={copyImage}
                                    aria-label="Copy image URL"
                                    className="text-white p-2 bg-black rounded-full hover:bg-black/80"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16h8a2 2 0 002-2V8a2 2 0 00-2-2h-8a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 20H6a2 2 0 01-2-2V10" />
                                    </svg>
                                </button>

                                {copied && <span className="text-white text-sm ml-2">Copied!</span>}
                            </div>

                            <div className="text-black text-sm">
                                {selectedIndex + 1}/{images.length}
                            </div>
                        </div>

                        <div className="flex-1 overflow-hidden flex items-center justify-center relative">
                            <img
                                src={images[selectedIndex].image_path ? `${host}/${images[selectedIndex].image_path}` : '/placeholder.svg'}
                                alt={images[selectedIndex].caption || 'full image'}
                                className="w-full h-auto max-h-[70vh] object-contain rounded filter brightness-100"
                            />
                            <button
                                onClick={(e) => { e.stopPropagation(); goPrev() }}
                                aria-label="Previous"
                                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-40 text-white rounded-full p-2 hover:bg-opacity-60"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>


                            <button
                                onClick={(e) => { e.stopPropagation(); goNext() }}
                                aria-label="Next"
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-40 text-white rounded-full p-2 hover:bg-opacity-60"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>

                        {images[selectedIndex].caption && (
                            <div className="text-white mt-2 text-sm">{images[selectedIndex].caption}</div>
                        )}

                        {/* thumbnail strip */}
                        <div className="mt-3 overflow-x-auto py-2 no-scrollbar">
                            <div className="flex gap-2 items-center px-1">
                                {images.map((thumb, i) => {
                                    const isActive = i === selectedIndex
                                    return (
                                        <button
                                            key={thumb.id}
                                            onClick={() => setSelectedIndex(i)}
                                            // attach ref only to the active thumb so we can center it
                                            ref={isActive ? activeThumbRef : undefined}
                                            className={`flex-shrink-0 rounded overflow-hidden border-2 transition-transform duration-150 ${isActive ? 'border-blue-400 scale-105' : 'border-transparent'}`}
                                            style={{ width: 80, height: 60 }}
                                        >
                                            <img
                                                src={thumb.image_path ? `${host}/${thumb.image_path}` : '/placeholder.svg'}
                                                alt={thumb.caption || `thumb-${i}`}
                                                // dim non-active thumbnails so the active one reads brighter
                                                className={`w-full h-full object-cover ${isActive ? 'filter brightness-100' : 'filter brightness-75'}`}
                                            />
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Images
