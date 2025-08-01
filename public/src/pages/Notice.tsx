import { Calendar } from "lucide-react"
import { useEffect } from "react"
import { format } from "date-fns"
import { useNoticeStore } from "../store/useNoticeStore"

export default function NoticePage() {
    const { loading, error, fetchNotices, getSortedNotices } = useNoticeStore();

    useEffect(() => {
        fetchNotices();
    }, [fetchNotices]);

    if (loading) {
        return (
            <div className="py-12">
                <div className="container-custom">
                    <div className="text-center">Loading notices...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="py-12">
                <div className="container-custom">
                    <div className="text-center text-red-500">Error: {error}</div>
                </div>
            </div>
        );
    }

    const sortedNotices = getSortedNotices();

    return (
        <div className="py-12">
            <div className="container-custom">
                <h1 className="section-title">Notices</h1>

                {sortedNotices.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-gray-500 text-lg">No notices available at the moment.</div>
                        <p className="text-gray-400 mt-2">Please check back later for updates.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6 mt-8">
                        {sortedNotices.map((notice) => (
                            <div
                                key={notice.id}
                                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                            >
                                <div className="p-6 relative">
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
                                    {/* Show Notice button */}
                                    <div className="absolute right-5 bottom-3 flex  gap-2">
                                        {notice.download_url && (
                                            <a
                                                href={notice.download_url}
                                                download
                                                className="text-primary hover:underline"
                                            >
                                                Download PDF
                                            </a>

                                        )}
                                        {notice.file && (
                                            <button
                                                className=" text-primary hover:underline"
                                                onClick={() => window.open(notice.file, "_blank")}
                                            >
                                                Show Notice
                                            </button>
                                        )}


                                    </div>
                                    {/* <iframe src={notice.file} width="100%"
                                        height="600px"
                                        title="PDF Preview"></iframe> */}


                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div >
    )
}
