import axios from 'axios'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom';

interface GalleryItem {
    id: number;
    title: string;
    thumbnail: string;
    category?: string;
}

function Gallery() {
    useEffect(() => {
        document.title = "Gallery";
    }, []);
    const host = import.meta.env.VITE_BACKEND_URL;
    const [active, setActive] = useState<'campus' | 'event'>('campus')
    const [campusItems, setCampusItems] = useState<GalleryItem[]>([])
    const [eventItems, setEventItems] = useState<GalleryItem[]>([])
    useEffect(() => {
        Promise.all([
            axios.get('/api/gallery/getCategories'),
            axios.get('/api/events/getEvents')
        ]).then(([categoriesRes, eventsRes]) => {
            console.log(categoriesRes.data, eventsRes.data);

            setCampusItems(categoriesRes.data.slice(1));
            setEventItems(eventsRes.data);
        }).catch(err => {
            console.error("Error fetching gallery data:", err);
        })


    }, [])

    const itemsToShow = active === 'campus' ? campusItems : eventItems

    return (
        <div className="p-4">
            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => setActive('campus')}
                    aria-pressed={active === 'campus'}
                    className={`px-3 py-2 rounded-md border transition focus:outline-none ${active === 'campus'
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-gray-300 bg-white hover:bg-gray-50'
                        }`}
                >
                    Campus Gallery
                </button>
                <button
                    onClick={() => setActive('event')}
                    aria-pressed={active === 'event'}
                    className={`px-3 py-2 rounded-md border transition focus:outline-none ${active === 'event'
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-gray-300 bg-white hover:bg-gray-50'
                        }`}
                >
                    Event Gallery
                </button>
            </div>

            <div
                className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
            >
                {itemsToShow.length === 0 ? (
                    <div className="col-span-full text-center text-sm text-gray-500 py-8">
                        No items to show.
                    </div>
                ) : (
                    itemsToShow.map((item) => (
                        <Link
                            key={item.id}
                            to={`/gallery/${active}/${item.id}`}
                            className="block rounded-lg overflow-hidden bg-white border border-gray-100 hover:shadow-md transition"
                        >
                            <img
                                src={item.thumbnail ? `${host}/${item.thumbnail}` : "/placeholder.svg"}
                                alt={item.title}
                                className="w-full h-36 object-cover block"
                            />
                            <div className="p-3">
                                <div className="font-semibold text-gray-800">{item.category!="Event" ? item.category : item.title}</div>
                                <div className="text-sm text-gray-500 mt-1">
                                    {active !== 'campus' && 'Event'}
                                </div>
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    )
}


export default Gallery