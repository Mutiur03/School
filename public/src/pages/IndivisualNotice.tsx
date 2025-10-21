"use client"
import { Calendar, ArrowLeft, Download, FileText } from "lucide-react"
import { Link } from "react-router-dom"
import { useParams } from 'react-router-dom';
import { useEffect } from "react";
import { useNoticeStore } from "../store/useNoticeStore";

export default function NoticeDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { getNoticeById, fetchNotices, loading, error } = useNoticeStore();
    const noticeId = id ? parseInt(id, 10) : null;
    const notice = noticeId ? getNoticeById(noticeId) : null;

    useEffect(() => {
        fetchNotices();
    }, [fetchNotices]);



    if (loading) {
        return (
            <div className="py-12">
                <div className="container-custom">
                    <div className="text-center">Loading notice...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="py-12">
                <div className="container-custom">
                    <div className="text-center text-red-500">Error: {error}</div>
                    <Link to="/notice" className="btn-primary mt-4 inline-block">
                        Back to Notices
                    </Link>
                </div>
            </div>
        );
    }

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
                                {new Date(notice.created_at).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </div>
                            <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">
                                {notice.category || "General"}
                            </span>
                        </div>

                        {notice.file && (
                            <div className="border-t pt-6">
                                <h3 className="text-lg font-semibold text-primary mb-4 flex items-center">
                                    <FileText size={20} className="mr-2" />
                                    Attachments
                                </h3>
                                <iframe src={notice.file} width="100%"
                                    height="600px"
                                    allow="autoplay"></iframe>
                                <a href={notice.download_url} target="_blank" rel="noopener noreferrer">
                                    <button
                                        className="inline-flex items-center px-4 mt-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                    >
                                        <Download size={16} className="mr-2" />
                                        Download PDF
                                    </button>
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            </div >
        </div >
    )
}
