"use client"
import { Calendar } from "lucide-react"
import { Link } from "react-router-dom"
// Sample notice data
const notices = [
    {
        id: 1,
        title: "Annual Sports Day 2024",
        date: "April 15, 2024",
        category: "Event",
        content:
            "Annual Sports Day will be held on May 10, 2024. All students are requested to participate in various sports events. The registration for different events will start from April 20, 2024.",
    },
    {
        id: 2,
        title: "Parent-Teacher Meeting",
        date: "April 10, 2024",
        category: "Meeting",
        content:
            "Parent-Teacher Meeting for Classes 6-10 will be held on April 20, 2024. Parents are requested to attend the meeting to discuss their child's academic progress.",
    },
    {
        id: 3,
        title: "Summer Vacation Notice",
        date: "April 5, 2024",
        category: "Holiday",
        content:
            "Summer vacation will start from May 15, 2024 and school will reopen on June 15, 2024. Students are advised to complete their holiday homework during the vacation.",
    },
    {
        id: 4,
        title: "Admission Notice for Class 6",
        date: "March 25, 2024",
        category: "Admission",
        content:
            "Admission for Class 6 for the academic year 2024-2025 will start from April 1, 2024. Interested candidates can collect admission forms from the school office.",
    },
    {
        id: 5,
        title: "Science Fair 2024",
        date: "March 20, 2024",
        category: "Event",
        content:
            "The school is organizing a Science Fair on April 25, 2024. Students from Classes 6-10 are encouraged to participate and showcase their scientific projects.",
    },
    {
        id: 6,
        title: "Final Examination Schedule",
        date: "March 15, 2024",
        category: "Examination",
        content:
            "The final examination for the academic year 2023-2024 will start from April 10, 2024. The detailed schedule has been published on the school notice board.",
    },
    {
        id: 7,
        title: "Cultural Program",
        date: "March 10, 2024",
        category: "Event",
        content:
            "A cultural program will be organized on May 5, 2024 to celebrate the school's foundation day. Students interested in participating should contact their class teachers.",
    },
    {
        id: 8,
        title: "Book Distribution",
        date: "March 5, 2024",
        category: "General",
        content:
            "Free textbooks for the academic year 2024-2025 will be distributed on April 5, 2024. Students are requested to collect their books according to the schedule provided.",
    },
]

export default function Event() {
    return (
        <div className="py-12">
            <div className="container-custom">
                <h1 className="section-title">Events</h1>

                <div className="grid grid-cols-1 gap-6 mt-8">
                    {notices.map((notice) => (
                        <div
                            key={notice.id}
                            className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                        >
                            <div className="p-6">
                                <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
                                    <h2 className="text-xl font-bold text-primary">{notice.title}</h2>
                                    <div className="flex items-center gap-4 mt-2 md:mt-0">
                                        <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">
                                            {notice.category}
                                        </span>
                                        <div className="flex items-center text-gray-500 text-sm">
                                            <Calendar size={16} className="mr-1" />
                                            {notice.date}
                                        </div>
                                    </div>
                                </div>
                                <p className="text-gray-600 mb-4">{notice.content}</p>
                                <Link to={`/event/${notice.id}`} className="inline-block text-primary hover:underline">
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
