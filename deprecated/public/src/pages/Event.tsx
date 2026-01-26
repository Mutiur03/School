"use client"
import { Calendar, MapPin } from "lucide-react"
import { Link } from "react-router-dom"
import { useEffect } from "react"
import { format } from "date-fns"
import { useEventStore } from "../store/useEventStore"

export default function Event() {
    const { events, loading, fetchEvents } = useEventStore()
    const host = import.meta.env.VITE_BACKEND_URL

    useEffect(() => {
        fetchEvents()
    }, [fetchEvents])

    return (
        <div className="py-12">
            <div className="container-custom">
                <h1 className="section-title">Events</h1>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <div
                                key={index}
                                className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse"
                            >
                                <div className="h-48 bg-gray-300"></div>
                                <div className="p-6">
                                    <div className="h-4 bg-gray-300 rounded mb-2"></div>
                                    <div className="h-3 bg-gray-300 rounded w-3/4 mb-2"></div>
                                    <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                        {events.length > 0 ? (
                            events.map((event) => (
                                <div
                                    key={event.id}
                                    className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                                >
                                    <div className="relative h-48">
                                        <img
                                            src={
                                                event.image
                                                    ? `${host}/${event.image}`
                                                    : "/placeholder.svg"
                                            }
                                            alt={event.title}
                                            className="object-cover w-full h-full"
                                        />
                                    </div>
                                    <div className="p-6">
                                        <h2 className="text-xl font-bold text-primary mb-2">{event.title}</h2>
                                        <div className="flex items-center justify-between gap-4 mb-3">
                                            <div className="flex items-center text-gray-500 text-sm">
                                                <Calendar size={16} className="mr-1" />
                                                {format(new Date(event.date), "MMM dd, yyyy")}
                                            </div>
                                            <div className="flex items-center text-gray-500 text-sm">
                                                <MapPin size={16} className="mr-1" />
                                                {event.location}
                                            </div>
                                        </div>
                                        <p className="text-gray-600 mb-4 line-clamp-3">
                                            {event.details.length > 100 ? event.details.slice(0, 100) + "..." : event.details}
                                        </p>
                                        <Link
                                            to={`/event/${event.id}`}
                                            className="inline-block text-primary hover:underline font-medium"
                                        >
                                            Read More →
                                        </Link>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center col-span-full text-gray-500 py-12">
                                <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
                                <p className="text-lg">No events available at the moment.</p>
                                <p className="text-sm mt-2">Check back later for upcoming events!</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
