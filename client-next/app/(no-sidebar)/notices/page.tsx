import { getFileUrl } from "@/lib/backend";
import { fetchNotices } from "@/queries/notice.queries";

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

async function Notice() {
    const notices = await fetchNotices();
    const sorted = [...notices].sort((a, b) => {
        const ta = new Date(a.created_at).getTime();
        const tb = new Date(b.created_at).getTime();
        return tb - ta;
    });

    return (
        <div className="mx-auto px-4 py-6">
            <h1 className="text-2xl font-semibold mb-4">Notices</h1>
            <p className="mb-4 text-sm text-gray-600">Total notices: {sorted.length}</p>

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
                        {sorted.length === 0 ? (
                            <tr>
                                <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={4}>
                                    No notices found.
                                </td>
                            </tr>
                        ) : (
                            <>
                                {sorted.map((n, idx) => (
                                    <tr key={n.id} className="hover:bg-gray-50 divide-x divide-gray-300">
                                        <td className="px-4 py-3 text-sm text-gray-700">{idx + 1}</td>
                                        <td className="px-4 py-3 text-sm text-gray-900">
                                            <a
                                                className="m-0 text-gray-900 text-sm leading-6 wrap-break-word transition-opacity duration-200"
                                                title={n?.title || ""}
                                                href={getFileUrl(n.file)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                {n.title}
                                            </a>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-700">{formatDate(n.created_at)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-center">
                                                <a href={getFileUrl(n.file)} target="_blank" rel="noopener noreferrer">
                                                    <img src="/pdf.png" alt="PDF" className="w-6 h-6" />
                                                </a>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default Notice;
