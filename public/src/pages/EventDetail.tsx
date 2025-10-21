"use client"
import { Calendar, MapPin, ArrowLeft, Images } from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { useEffect } from "react"
import { format } from "date-fns"
import { useEventStore } from "../store/useEventStore"

export default function EventDetail() {
    const { id } = useParams()
    const { events, loading, fetchEvents, getEventById } = useEventStore()

    const event = getEventById(parseInt(id || '0'))

    useEffect(() => {
        // Only fetch events if not already loaded
        if (events.length === 0) {
            fetchEvents()
        }
    }, [events.length, fetchEvents])

    if (loading) {
        return (
            <div className="py-12">
                <div className="container-custom">
                    <div className="animate-pulse">
                        <div className="h-8 bg-gray-300 rounded w-1/4 mb-8"></div>
                        <div className="h-64 bg-gray-300 rounded mb-6"></div>
                        <div className="h-6 bg-gray-300 rounded w-3/4 mb-4"></div>
                        <div className="h-4 bg-gray-300 rounded w-1/2 mb-4"></div>
                        <div className="h-4 bg-gray-300 rounded w-full mb-2"></div>
                        <div className="h-4 bg-gray-300 rounded w-5/6"></div>
                    </div>
                </div>
            </div>
        )
    }

    if (!event) {
        return (
            <div className="py-12">
                <div className="container-custom">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold mb-4">Event Not Found</h1>
                        <p className="text-gray-600 mb-6">The event you're looking for doesn't exist.</p>
                        <Link
                            to="/events"
                            className="inline-flex items-center text-primary hover:underline"
                        >
                            <ArrowLeft size={16} className="mr-1" />
                            Back to Events
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="py-12">
            <div className="container-custom">
                <div className="flex items-center justify-between mb-6">
                    <Link
                        to="/events"
                        className="inline-flex items-center text-primary hover:underline"
                    >
                        <ArrowLeft size={16} className="mr-1" />
                        Back to Events
                    </Link>

                    <Link
                        to={`/gallery/events/${event?.id}`}
                        className="inline-flex items-center bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                    >
                        <Images size={16} className="mr-2" />
                        View Gallery
                    </Link>
                </div>

                <div className="bg-white rounded-lg shadow-lg overflow-hidden">


                    <div className="p-6 md:p-8">
                        <h1 className="text-3xl font-bold text-primary mb-4">{event.title}</h1>

                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                            <div className="flex items-center text-gray-600">
                                <Calendar size={20} className="mr-2" />
                                <span className="font-medium">
                                    {format(new Date(event.date), "EEEE, MMMM dd, yyyy")}
                                </span>
                            </div>
                            <div className="flex items-center text-gray-600">
                                <MapPin size={20} className="mr-2" />
                                <span className="font-medium">{event.location}</span>
                            </div>
                        </div>

                        <div className="prose max-w-none mb-6">
                            <p className="text-gray-700 leading-relaxed text-lg">
                                {event.details}
                            </p>
                        </div>

                        {event.file && (
                            <div className="bg-gray-50 rounded-lg p-4">
                                <h3 className="font-semibold mb-2">Related Documents</h3>
                                <a
                                    href={event.file}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block bg-primary text-white px-4 py-2 rounded hover:bg-primary/90 transition-colors"
                                >
                                    Open Document
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
