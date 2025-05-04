"use client"
import { Calendar } from "lucide-react"
import { Link } from "react-router-dom"
import { useEffect, useState } from "react"
import axios from "axios"
import { format } from "date-fns"
type Notice = {
    id: number;
    title: string;
    details: string;
    created_at: string;
    category: string;
}

export default function NoticePage() {
    const [notices, setNotices] = useState<Notice[]>([]);
    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [noticesRes, eventsRes] = await Promise.all([
                    axios.get("/api/notices/getNotices"),
                    axios.get("/api/events/getEvents"),
                ]);

                const noticesData = noticesRes.data?.data || [];
                const eventsData = eventsRes.data || [];

                setNotices([...noticesData, ...eventsData]);
            } catch (error) {
                console.error("Error fetching notices or events:", error);
            }
        };

        fetchAll();
    }, []);

    return (
        <div className="py-12">
            <div className="container-custom">
                <h1 className="section-title">Notices</h1>

                <div className="grid grid-cols-1 gap-6 mt-8">
                    {notices
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .map((notice) => (
                            <div
                                key={notice.id}
                                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                            >
                                <div className="p-6">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
                                        <h2 className="text-xl font-bold text-primary">{notice.title}</h2>
                                        <div className="flex items-center gap-4 mt-2 md:mt-0">
                                            <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">
                                                {notice.category ? notice.category : "General"}
                                            </span>
                                            <div className="flex items-center text-gray-500 text-sm">
                                                <Calendar size={16} className="mr-1" />
                                                {format(new Date(notice.created_at), "MMM dd, yyyy")}
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-gray-600 mb-4 text-start">{notice.details}</p>
                                    <Link to={notice.category === "Event" ? `/events/${notice.id}` : `/notice/${notice.id}`} className="inline-block text-primary hover:underline">
                                        Read More
                                    </Link>
                                </div>
                            </div>
                        ))}
                </div>
            </div>
        </div>
    )
}
