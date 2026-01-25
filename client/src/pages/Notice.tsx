import { useEffect, useMemo, useState } from "react";
import { useAllNotices } from "@/hooks/useSchoolData";

function formatDate(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function Notice() {
  useEffect(() => {
    document.title = "Notices";
  }, []);
  const { data: Notices = [], isLoading } = useAllNotices();
  const [pageSize, setPageSize] = useState<number>(20);
  const [query, setQuery] = useState<string>("");
  const [page, setPage] = useState<number>(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = [...Notices].sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return tb - ta;
    });
    if (!q) return items;
    return items.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        formatDate(n.created_at).toLowerCase().includes(q),
    );
  }, [query, Notices]);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const startIndex = filtered.length ? (page - 1) * pageSize : 0;
  const endIndex = Math.min(startIndex + pageSize, filtered.length);
  const visible = filtered.slice(startIndex, endIndex);

  const pagesToShow = useMemo(() => {
    const max = Math.min(totalPages, 5);
    const start = Math.max(1, Math.min(page - 2, totalPages - max + 1));
    return Array.from({ length: max }, (_, i) => start + i);
  }, [page, totalPages]);

  return (
    <div className="mx-auto px-4 py-6">
      <h1 className="text-2xl font-semibold mb-4">Notices</h1>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="inline-flex items-center gap-2 text-sm">
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

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-xs shadow-sm ring-1 ring-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr className="text-left text-sm font-semibold text-gray-700">
              <th className="px-4 py-3 w-16">ক্রমিক</th>
              <th className="px-4 py-3">শিরোনাম</th>
              <th className="px-4 py-3 w-28">প্রকাশের তারিখ</th>
              <th className="px-4 py-3 w-20 text-center">ডাউনলোড</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-300">
            {isLoading && Notices.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-6 text-center text-sm text-gray-500"
                  colSpan={4}
                >
                  Loading notices...
                </td>
              </tr>
            ) : (
              <>
                {visible.map((n, idx) => (
                  <tr
                    key={n.id}
                    className="hover:bg-gray-50 divide-x divide-gray-300"
                  >
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {startIndex + idx + 1}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <a
                        className="m-0 text-gray-900 text-sm leading-6 wrap-break-word transition-opacity duration-200"
                        title={n?.title || ""}
                        href={n?.file || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {n.title}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatDate(n.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <a
                          href={n.download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <img src="/pdf.png" alt="PDF" className="w-6 h-6" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}

                {visible.length === 0 && (
                  <tr>
                    <td
                      className="px-4 py-6 text-center text-sm text-gray-500"
                      colSpan={4}
                    >
                      No notices found.
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-gray-600">
        <p>
          Showing {filtered.length ? startIndex + 1 : 0} to {endIndex} of{" "}
          {filtered.length} entries
        </p>
        <nav className="inline-flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || filtered.length === 0}
            className={`px-2 py-1 border rounded ${page === 1 || filtered.length === 0 ? "text-gray-400 border-gray-200 cursor-not-allowed" : "hover:bg-gray-50"}`}
          >
            Previous
          </button>
          {pagesToShow.map((pn) => (
            <button
              key={pn}
              onClick={() => setPage(pn)}
              className={`px-2 py-1 border rounded ${pn === page ? "bg-gray-200 border-gray-300" : "hover:bg-gray-50"}`}
            >
              {pn}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || filtered.length === 0}
            className={`px-2 py-1 border rounded ${page === totalPages || filtered.length === 0 ? "text-gray-400 border-gray-200 cursor-not-allowed" : "hover:bg-gray-50"}`}
          >
            Next
          </button>
        </nav>
      </div>
    </div>
  );
}

export default Notice;
