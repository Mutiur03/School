import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';

type NoticeItem = {
    id: number;
    title: string;
    created_at: string; // ISO date string
    download_url: string;
    file?: string;
};

function formatDate(iso: string) {
    if (!iso) return '';
    // Take only the date part before 'T' or whitespace
    const datePart = iso.split(/[T\s]/)[0];
    // Prefer YYYY-MM-DD parsing to avoid timezone shifts
    const [yStr, mStr, dStr] = datePart.split('-');
    const y = Number(yStr);
    const m = Number(mStr) || 1;
    const d = Number(dStr) || 1;

    let date: Date | null = null;
    if (y && !Number.isNaN(y)) {
        date = new Date(y, m - 1, d);
    } else {
        // Fallback for other formats
        const parsed = new Date(iso);
        if (!Number.isNaN(parsed.getTime())) date = parsed;
    }

    if (!date || Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(date); // e.g., "30 September 2025"
}

function Notice() {
    const [pageSize, setPageSize] = useState<number>(20);
    const [query, setQuery] = useState<string>('');
    const [Notices, setNotices] = useState<NoticeItem[]>([])
    // NEW: loading state
    const [isLoading, setIsLoading] = useState<boolean>(true);
    // NEW: current page
    const [page, setPage] = useState<number>(1);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        const items = [...Notices].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        if (!q) return items;
        return items.filter(
            n =>
                n.title.toLowerCase().includes(q) ||
                formatDate(n.created_at).toLowerCase().includes(q)
        );
    }, [query, Notices]); // FIX: include Notices

    useEffect(() => {
        setIsLoading(true);
        axios.get('/api/notices/getNotices')
            .then(res => {
                console.log(res.data);
                setNotices(res.data);
                setIsLoading(false);
            })
            .catch(() => {
                setIsLoading(false);
            });
    }, []);

    // NEW: reset page when query/pageSize changes
    useEffect(() => {
        setPage(1);
    }, [query, pageSize]);

    // NEW: paging math
    const totalPages = Math.ceil(filtered.length / pageSize) || 1;
    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [totalPages, page]);

    const startIndex = filtered.length ? (page - 1) * pageSize : 0;
    const endIndex = Math.min(startIndex + pageSize, filtered.length);
    const visible = filtered.slice(startIndex, endIndex);

    // NEW: compact page numbers (max 5)
    const pagesToShow = useMemo(() => {
        const max = Math.min(totalPages, 5);
        const start = Math.max(1, Math.min(page - 2, totalPages - max + 1));
        return Array.from({ length: max }, (_, i) => start + i);
    }, [page, totalPages]);

    return (
        <div className="mx-auto max-w-7xl px-4 py-6">
            <h1 className="text-2xl font-semibold mb-4">Notices</h1>

            {/* Controls */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="inline-flex items-center gap-2 text-sm">
                    <span>Show</span>
                    <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="border rounded-xs px-2 py-1 text-sm"
                    >
                        {[10, 20, 50, 100].map(n => (
                            <option key={n} value={n}>{n}</option>
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

            {/* Table */}
            <div className="overflow-x-auto bg-white rounded-xs shadow-sm ring-1 ring-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr className="text-left text-sm font-semibold text-gray-700">
                            <th className="px-4 py-3 w-16">ক্রমিক</th>
                            <th className="px-4 py-3">শিরোনাম</th>
                            <th className="px-4 py-3 w-40">প্রকাশের তারিখ</th>
                            <th className="px-4 py-3 w-32 text-center">ডাউনলোড</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-300">
                        {isLoading && Notices.length === 0 ? (
                            <tr>
                                <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={4}>
                                    Loading notices...
                                </td>
                            </tr>
                        ) : (
                            <>
                                {visible.map((n, idx) => (
                                    <tr key={n.id} className="hover:bg-gray-50 divide-x divide-gray-300">
                                        <td className="px-4 py-3 text-sm text-gray-700">{startIndex + idx + 1}</td>
                                        <td className="px-4 py-3 text-sm text-gray-900"><a
                                            className="m-0 text-gray-900 text-sm leading-6 truncate flex-1 transition-opacity duration-200"
                                            title={n?.title || ''}
                                            href={n?.file || '#'}
                                            target='_blank'
                                        >{n.title}</a></td>
                                        <td className="px-4 py-3 text-sm text-gray-700">{formatDate(n.created_at)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-center">
                                                <a
                                                    href={n.download_url}
                                                    // target="_blank"
                                                    rel="noreferrer"
                                                // className="inline-flex items-center gap-2 rounded-md bg-red-500 px-3 py-1.5 text-white text-xs font-medium hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400"
                                                >
                                                    {/* <PdfIcon className="w-4 h-4" /> */}
                                                    <img src="/pdf.png" alt="" className='w-6 h-6' />
                                                    {/* <span>PDF</span> */}
                                                </a>
                                            </div>
                                        </td>
                                    </tr>
                                ))}

                                {visible.length === 0 && (
                                    <tr>
                                        <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={4}>
                                            No notices found.
                                        </td>
                                    </tr>
                                )}
                            </>
                        )}
                    </tbody>
                </table>
            </div>

            {/* NEW: footer with range + pagination */}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-gray-600">
                <p>
                    Showing {filtered.length ? startIndex + 1 : 0} to {endIndex} of {filtered.length} entries
                </p>
                <nav className="inline-flex items-center gap-1">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1 || filtered.length === 0}
                        className={`px-2 py-1 border rounded ${page === 1 || filtered.length === 0 ? 'text-gray-400 border-gray-200 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                    >
                        Previous
                    </button>
                    {pagesToShow.map(pn => (
                        <button
                            key={pn}
                            onClick={() => setPage(pn)}
                            className={`px-2 py-1 border rounded ${pn === page ? 'bg-gray-200 border-gray-300' : 'hover:bg-gray-50'}`}
                        >
                            {pn}
                        </button>
                    ))}
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages || filtered.length === 0}
                        className={`px-2 py-1 border rounded ${page === totalPages || filtered.length === 0 ? 'text-gray-400 border-gray-200 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                    >
                        Next
                    </button>
                </nav>
            </div>
        </div>
    );
}

export default Notice;
