"use client"
import { Calendar, ArrowLeft } from "lucide-react"
import { Link } from "react-router-dom"
import { useParams } from 'react-router-dom';

// Sample notice data
const notices = [
    {
        id: 1,
        title: "Annual Sports Day 2024",
        date: "April 15, 2024",
        category: "Event",
        content: `
      <p>Annual Sports Day will be held on May 10, 2024. All students are requested to participate in various sports events. The registration for different events will start from April 20, 2024.</p>
      
      <h3>Events:</h3>
      <ul>
        <li>100m Race</li>
        <li>200m Race</li>
        <li>Long Jump</li>
        <li>High Jump</li>
        <li>Shot Put</li>
        <li>Relay Race</li>
        <li>Football</li>
        <li>Cricket</li>
      </ul>
      
      <p>Students can register for a maximum of three individual events and two team events. Registration forms will be available with the class teachers.</p>
      
      <p>Parents are cordially invited to attend the Sports Day and encourage their children.</p>
      
      <p>For any queries, please contact the Sports Department.</p>
    `,
    },
    {
        id: 2,
        title: "Parent-Teacher Meeting",
        date: "April 10, 2024",
        category: "Meeting",
        content: `
      <p>Parent-Teacher Meeting for Classes 6-10 will be held on April 20, 2024. Parents are requested to attend the meeting to discuss their child's academic progress.</p>
      
      <h3>Schedule:</h3>
      <ul>
        <li>Class 6: 9:00 AM - 10:30 AM</li>
        <li>Class 7: 10:30 AM - 12:00 PM</li>
        <li>Class 8: 12:00 PM - 1:30 PM</li>
        <li>Class 9: 2:00 PM - 3:30 PM</li>
        <li>Class 10: 3:30 PM - 5:00 PM</li>
      </ul>
      
      <p>Parents are requested to bring their child's report card and note down any concerns they want to discuss with the teachers.</p>
      
      <p>For any queries, please contact the school office.</p>
    `,
    },
    {
        id: 3,
        title: "Summer Vacation Notice",
        date: "April 5, 2024",
        category: "Holiday",
        content: `
      <p>Summer vacation will start from May 15, 2024 and school will reopen on June 15, 2024. Students are advised to complete their holiday homework during the vacation.</p>
      
      <p>Holiday homework for all classes will be available on the school website from May 10, 2024. Students are required to submit their homework on the first day of school after vacation.</p>
      
      <p>The school office will remain open on all working days during the vacation from 9:00 AM to 1:00 PM for administrative work.</p>
      
      <p>We wish all students a happy and safe summer vacation.</p>
    `,
    },
    {
        id: 4,
        title: "Admission Notice for Class 6",
        date: "March 25, 2024",
        category: "Admission",
        content: `
      <p>Admission for Class 6 for the academic year 2024-2025 will start from April 1, 2024. Interested candidates can collect admission forms from the school office.</p>
      
      <h3>Eligibility:</h3>
      <p>Students who have passed Class 5 from any recognized school are eligible to apply.</p>
      
      <h3>Required Documents:</h3>
      <ul>
        <li>Completed application form</li>
        <li>Two passport-size photographs</li>
        <li>Copy of birth certificate</li>
        <li>Copy of Class 5 report card</li>
        <li>Transfer certificate from previous school (if applicable)</li>
      </ul>
      
      <h3>Important Dates:</h3>
      <ul>
        <li>Form Distribution: April 1-15, 2024</li>
        <li>Submission of Forms: April 1-20, 2024</li>
        <li>Entrance Examination: April 25, 2024</li>
        <li>Result Declaration: May 5, 2024</li>
        <li>Admission: May 10-20, 2024</li>
      </ul>
      
      <p>For any queries, please contact the school office.</p>
    `,
    },
]

export default function NoticeDetailPage() {
    const { id } = useParams<{ id: string }>();
    const noticeId = id? parseInt(id, 10) : null;
    const notice = notices.find((n) => n.id === noticeId)

    if (!notice) {
        return (
            <div className="py-12">
                <div className="container-custom">
                    <h1 className="section-title">Notice Not Found</h1>
                    <p className="mt-4">The notice you are looking for does not exist.</p>
                    <Link to="/notice" className="btn-primary mt-4 inline-block">
                        Back to Notices
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="py-12">
            <div className="container-custom">
                <Link to="/notice" className="inline-flex items-center text-primary hover:underline mb-6">
                    <ArrowLeft size={16} className="mr-1" />
                    Back to Notices
                </Link>

                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    <div className="p-6">
                        <h1 className="text-2xl md:text-3xl font-bold text-primary mb-4">{notice.title}</h1>

                        <div className="flex flex-wrap items-center gap-4 mb-6 text-gray-600">
                            <div className="flex items-center">
                                <Calendar size={18} className="mr-1" />
                                {notice.date}
                            </div>
                            <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">
                                {notice.category}
                            </span>
                        </div>

                        <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: notice.content }} />
                    </div>
                </div>
            </div>
        </div>
    )
}
