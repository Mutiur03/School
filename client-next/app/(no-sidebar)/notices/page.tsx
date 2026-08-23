import { getFileUrl } from '@/lib/backend';
import { fetchNotices } from '@/queries/notice.queries';
import Image from 'next/image';

function formatDate(iso?: string) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

async function Notice() {
  const notices = await fetchNotices();
  const sorted = notices.slice().sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    return tb - ta;
  });

  return (
    <div className="mx-auto px-4 py-6 sm:py-8">
      <h1 className="mb-2 text-xl font-semibold text-balance sm:mb-4 sm:text-2xl">Notices</h1>
      <p className="mb-4 text-sm text-gray-600">Total notices: {sorted.length}</p>

      {sorted.length === 0 ? (
        <p className="rounded-md border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
          No notices found.
        </p>
      ) : (
        <>
          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {sorted.map((n, idx) => (
              <li key={n.id} className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-500 tabular-nums">#{idx + 1}</p>
                    <a
                      className="mt-1 block text-sm leading-6 font-medium wrap-break-word text-gray-900"
                      title={n?.title || ''}
                      href={getFileUrl(n.file)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {n.title}
                    </a>
                    <p className="mt-2 text-xs text-gray-600">{formatDate(n.created_at)}</p>
                  </div>
                  <a
                    href={getFileUrl(n.file)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600"
                    aria-label={`Download ${n.title || 'notice'} PDF`}
                  >
                    <Image src="/pdf.png" alt="" width={28} height={28} aria-hidden="true" />
                  </a>
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-xs bg-white shadow-sm ring-1 ring-gray-200 md:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr className="text-left text-sm font-semibold text-gray-700">
                  <th className="w-16 px-4 py-3">ক্রমিক</th>
                  <th className="px-4 py-3">শিরোনাম</th>
                  <th className="w-28 px-4 py-3">প্রকাশের তারিখ</th>
                  <th className="w-20 px-4 py-3 text-center">ডাউনলোড</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300">
                {sorted.map((n, idx) => (
                  <tr key={n.id} className="divide-x divide-gray-300 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700 tabular-nums">{idx + 1}</td>
                    <td className="min-w-0 px-4 py-3 text-sm text-gray-900">
                      <a
                        className="m-0 text-sm leading-6 wrap-break-word text-gray-900 transition-opacity duration-200"
                        title={n?.title || ''}
                        href={getFileUrl(n.file)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {n.title}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-700">
                      {formatDate(n.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <a
                          href={getFileUrl(n.file)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Download ${n.title || 'notice'} PDF`}
                        >
                          <Image src="/pdf.png" alt="" width={24} height={24} aria-hidden="true" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default Notice;
