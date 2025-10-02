import { useEffect, useMemo, useState } from "react";
import axios from "axios";

type EventItem = {
    id: number;
    title: string;
    date: string;
    location?: string;
    details?: string;
    image?: string;
    // possible pdf keys from backend
    pdf?: string;
    pdf_url?: string;
    download_url?: string;
};

function formatDate(iso: string) {
    if (!iso) return "";
    const datePart = iso.split(/[T\s]/)[0];
    const [yStr, mStr, dStr] = datePart.split("-");
    const y = Number(yStr);
    const m = Number(mStr) || 1;
    const d = Number(dStr) || 1;
    let date: Date | null = null;
    if (y && !Number.isNaN(y)) date = new Date(y, m - 1, d);
    else {
        const parsed = new Date(iso);
        if (!Number.isNaN(parsed.getTime())) date = parsed;
    }
    if (!date || Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(date);
}

export default function Event() {
    const [events, setEvents] = useState<EventItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [pageSize, setPageSize] = useState(20);
    const [page, setPage] = useState(1);
    const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const host = (import.meta).env?.VITE_BACKEND_URL || "";

    useEffect(() => {
        setIsLoading(true);
        axios
            .get("/api/events/getEvents")
            .then((res) => {
                setEvents(res.data || []);
            })
            .catch(() => {
                setEvents([]);
            })
            .finally(() => setIsLoading(false));
    }, []);

    useEffect(() => {
        setPage(1);
    }, [query, pageSize]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        const items = [...events].sort((a, b) => (a.date < b.date ? 1 : -1));
        if (!q) return items;
        return items.filter(
            (e) =>
                e.title.toLowerCase().includes(q) ||
                (formatDate(e.date) || "").toLowerCase().includes(q) ||
                (e.location || "").toLowerCase().includes(q)
        );
    }, [query, events]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [totalPages, page]);

    const startIndex = filtered.length ? (page - 1) * pageSize : 0;
    const endIndex = Math.min(startIndex + pageSize, filtered.length);
    const visible = filtered.slice(startIndex, endIndex);

    const pagesToShow = useMemo(() => {
        const max = Math.min(totalPages, 5);
        const start = Math.max(1, Math.min(page - 2, totalPages - max + 1));
        return Array.from({ length: max }, (_, i) => start + i);
    }, [page, totalPages]);

    function resolvePdfUrl(ev: EventItem) {
        const candidate = ev.pdf || ev.pdf_url || ev.download_url || "";
        if (!candidate) return "";
        // if candidate looks like a full URL, return as-is
        if (/^https?:\/\//i.test(candidate)) return candidate;
        // else build with host if available
        return host ? `${host}/${candidate.replace(/^\/+/, "")}` : candidate;
    }

    // disable background scrolling while modal is open and restore on close
    useEffect(() => {
        const prev = document.body.style.overflow;
        if (isModalOpen) document.body.style.overflow = "hidden";
        else document.body.style.overflow = prev || "";
        return () => { document.body.style.overflow = prev || ""; };
    }, [isModalOpen]);

    return (
        <div className="mx-auto max-w-7xl px-4 py-6">
            <h1 className="text-2xl font-semibold mb-4 text-gray-900">Events</h1>

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="inline-flex items-center gap-2 text-sm text-gray-900">
                    <span>Show</span>
                    <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="border rounded-xs px-2 py-1 text-sm"
                    >
                        {[10, 20, 50, 100].map((n) => (
                            <option key={n} value={n}>
                                {n}
                            </option>
                        ))}
                    </select>
                    <span>entries</span>
                </label>
                <label className="relative w-full sm:w-64">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search..."
                        className="w-full border rounded-xs pl-3 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </label>
            </div>

            <div className="overflow-hidden bg-white text-gray-900 rounded-xs shadow-sm ring-1 ring-gray-200">
                {isLoading && events.length === 0 ? (
                    <div className="p-6 text-center text-gray-600">Loading events...</div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr className="text-left text-sm font-semibold text-gray-700">
                                <th className="px-4 py-3 w-12">SL</th>
                                <th className="px-4 py-3">Title</th>
                                <th className="px-4 py-3 w-40">Date</th>
                                <th className="px-4 py-3 w-36 text-center">See details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {visible.length === 0 ? (
                                <tr>
                                    <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={4}>
                                        No events found.
                                    </td>
                                </tr>
                            ) : (
                                visible.map((ev, idx) => {
                                    return (
                                        <tr key={ev.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-sm text-gray-700">{startIndex + idx + 1}</td>
                                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{ev.title}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700">{formatDate(ev.date)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => { setSelectedEvent(ev); setIsModalOpen(true); }}
                                                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                                                >
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-gray-600">
                <p>
                    Showing {filtered.length ? startIndex + 1 : 0} to {endIndex} of {filtered.length} entries
                </p>
                <nav className="inline-flex items-center gap-1">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1 || filtered.length === 0}
                        className={`px-2 py-1 border rounded ${page === 1 || filtered.length === 0 ? "text-gray-400 border-gray-200 cursor-not-allowed" : "hover:bg-gray-100"}`}
                    >
                        Previous
                    </button>
                    {pagesToShow.map((pn) => (
                        <button
                            key={pn}
                            onClick={() => setPage(pn)}
                            className={`px-2 py-1 border rounded ${pn === page ? "bg-gray-200 border-gray-300" : "hover:bg-gray-100"}`}
                        >
                            {pn}
                        </button>
                    ))}
                    <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages || filtered.length === 0}
                        className={`px-2 py-1 border rounded ${page === totalPages || filtered.length === 0 ? "text-gray-400 border-gray-200 cursor-not-allowed" : "hover:bg-gray-100"}`}
                    >
                        Next
                    </button>
                </nav>
            </div>

            {/* Details modal */}
            {isModalOpen && selectedEvent && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center">
                    <div
                        className="fixed inset-0 bg-black opacity-40 z-[9998]"
                        onClick={() => { setIsModalOpen(false); setSelectedEvent(null); }}
                    />
                    <div className="relative bg-white text-gray-900 rounded-lg p-6 z-[9999] max-w-2xl w-full mx-4 shadow-lg max-h-[90vh] overflow-auto">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <h2 className="text-lg font-semibold">{selectedEvent.title}</h2>
                                <p className="text-sm text-gray-600">{formatDate(selectedEvent.date)}</p>
                            </div>
                            <button onClick={() => { setIsModalOpen(false); setSelectedEvent(null); }} className="text-gray-500 hover:text-gray-700">Close</button>
                        </div>
                        {selectedEvent.image && (
                            <div className="w-full mb-4 overflow-hidden rounded">
                                <img
                                    src={host ? `${host}/${selectedEvent.image.replace(/^\/+/, "")}` : selectedEvent.image}
                                    alt={selectedEvent.title}
                                    className="w-full object-contain rounded"
                                    style={{ display: "block", maxWidth: "100%", maxHeight: "40vh" }}
                                    loading="lazy"
                                    decoding="async"
                                />
                            </div>
                        )}
                        {/* PDF link (if any) */}
                        {resolvePdfUrl(selectedEvent) ? (
                            <div className="mb-4">
                                <a
                                    href={resolvePdfUrl(selectedEvent)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 text-blue-600 hover:underline"
                                >
                                    <img src="/pdf.png" alt="pdf" className="w-5 h-5" />
                                    Open PDF
                                </a>
                            </div>
                        ) : null}
                        <div className="text-sm text-gray-700 whitespace-pre-line">
                            {selectedEvent.details || "-"}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
