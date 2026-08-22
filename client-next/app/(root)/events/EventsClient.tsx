'use client';

import { getFileUrl } from '@/lib/cdn';
import { useMemo, useState, useEffect } from 'react';
import Image from 'next/image';

type EventItem = {
  id: number;
  title: string;
  date: string;
  location?: string;
  details?: string;
  image?: string;
  pdf?: string;
  pdf_url?: string;
  download_url?: string;
};

function formatDate(iso: string) {
  if (!iso) return '';
  const datePart = iso.split(/[T\s]/)[0];
  const [yStr, mStr, dStr] = datePart.split('-');
  const y = Number(yStr);
  const m = Number(mStr) || 1;
  const d = Number(dStr) || 1;
  let date: Date | null = null;
  if (y && !Number.isNaN(y)) date = new Date(y, m - 1, d);
  else {
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }
  if (!date || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function resolvePdfUrl(ev: EventItem): string {
  const candidate = ev.pdf || ev.pdf_url || ev.download_url || '';
  return getFileUrl(candidate);
}

interface Props {
  events: EventItem[];
}

export default function EventsClient({ events }: Props) {
  const [query, setQuery] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Reset to page 1 when search or page size changes
  useEffect(() => {
    setPage(1);
  }, [query, pageSize]);

  // Disable background scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = isModalOpen ? 'hidden' : prev || '';
    return () => {
      document.body.style.overflow = prev || '';
    };
  }, [isModalOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...events].sort((a, b) => (a.date < b.date ? 1 : -1));
    if (!q) return sorted;
    return sorted.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (formatDate(e.date) || '').toLowerCase().includes(q) ||
        (e.location || '').toLowerCase().includes(q),
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

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold text-gray-900">Events</h1>

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="inline-flex items-center gap-2 text-sm text-gray-900">
          <span>Show</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded-xs border px-2 py-1 text-sm"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span>entries</span>
        </label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          className="w-full rounded-xs border py-2 pr-3 pl-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none sm:w-64"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xs bg-white text-gray-900 shadow-sm ring-1 ring-gray-200">
        {events.length === 0 ? (
          <div className="p-6 text-center text-gray-600">No events available.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr className="text-left text-sm font-semibold text-gray-700">
                <th className="w-12 px-4 py-3">SL</th>
                <th className="px-4 py-3">Title</th>
                <th className="w-40 px-4 py-3">Date</th>
                <th className="w-36 px-4 py-3 text-center">See details</th>
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
                visible.map((ev, idx) => (
                  <tr key={ev.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">{startIndex + idx + 1}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{ev.title}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatDate(ev.date)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => {
                          setSelectedEvent(ev);
                          setIsModalOpen(true);
                        }}
                        className="rounded bg-blue-600 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-700"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="mt-3 flex flex-col gap-2 text-xs text-gray-600 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Showing {filtered.length ? startIndex + 1 : 0} to {endIndex} of {filtered.length} entries
        </p>
        <nav className="inline-flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || filtered.length === 0}
            className={`rounded border px-2 py-1 ${page === 1 || filtered.length === 0 ? 'cursor-not-allowed border-gray-200 text-gray-400' : 'hover:bg-gray-100'}`}
          >
            Previous
          </button>
          {pagesToShow.map((pn) => (
            <button
              key={pn}
              onClick={() => setPage(pn)}
              className={`rounded border px-2 py-1 ${pn === page ? 'border-gray-300 bg-gray-200' : 'hover:bg-gray-100'}`}
            >
              {pn}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || filtered.length === 0}
            className={`rounded border px-2 py-1 ${page === totalPages || filtered.length === 0 ? 'cursor-not-allowed border-gray-200 text-gray-400' : 'hover:bg-gray-100'}`}
          >
            Next
          </button>
        </nav>
      </div>

      {/* Details modal */}
      {isModalOpen && selectedEvent && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* Backdrop */}
          <div className="fixed inset-0 z-[9998] bg-black/40" onClick={closeModal} />
          {/* Panel */}
          <div className="relative z-[9999] mx-4 max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-white p-6 text-gray-900 shadow-lg">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{selectedEvent.title}</h2>
                <p className="text-sm text-gray-600">{formatDate(selectedEvent.date)}</p>
                {selectedEvent.location && (
                  <p className="mt-0.5 text-sm text-gray-500">📍 {selectedEvent.location}</p>
                )}
              </div>
              <button
                onClick={closeModal}
                className="shrink-0 text-sm font-medium text-gray-500 hover:text-gray-800"
              >
                Close
              </button>
            </div>

            {/* Event image */}
            {selectedEvent.image && (
              <div className="mb-4 w-full overflow-hidden rounded">
                <Image
                  src={getFileUrl(selectedEvent.image)}
                  alt={selectedEvent.title}
                  width={800}
                  height={400}
                  className="w-full rounded object-contain"
                  style={{ maxHeight: '40vh' }}
                />
              </div>
            )}

            {/* PDF link */}
            {resolvePdfUrl(selectedEvent) && (
              <div className="mb-4">
                <a
                  href={resolvePdfUrl(selectedEvent)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                  <Image src="/pdf.png" alt="pdf" width={20} height={20} />
                  Open PDF
                </a>
              </div>
            )}

            {/* Details text */}
            <div className="text-sm whitespace-pre-line text-gray-700">
              {selectedEvent.details || '-'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
