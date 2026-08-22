import { fetchNotices } from '@/queries/notice.queries';
import { getFileUrl } from '@/lib/backend';
import Link from '@/components/Link';

export async function TopBanner() {
  const data = await fetchNotices(5);
  const duration = 5 * (data?.length ?? 0);
  return (
    <div className="mt-2 w-full border-t border-b border-gray-100 bg-gray-50">
      <style>{`
        @keyframes marquee-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-track {
          display: inline-flex;
          white-space: nowrap;
          animation: marquee-scroll linear infinite;
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-track {
            animation: none;
            flex-wrap: wrap;
            white-space: normal;
          }
        }
      `}</style>

      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-1">
        <div className="min-w-0 flex-1 overflow-hidden">
          {!data || data.length === 0 ? (
            <span className="text-sm leading-6 text-gray-500">কোনো নোটিশ নেই</span>
          ) : (
            <div
              className="marquee-track text-sm leading-6"
              style={{ animationDuration: `${duration}s`, animationDelay: '5s' }}
            >
              {data.map((notice, i) => (
                <a
                  key={i}
                  href={getFileUrl(notice.file) || '#'}
                  target="_blank"
                  rel="noreferrer"
                  title={notice.title || ''}
                  className="mr-8 inline-flex min-h-6 items-center text-gray-900 before:mr-1 before:text-xs before:font-bold before:text-[#609513] before:content-['▶'] hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                >
                  {notice.title}
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0">
          <Link
            href="/notices"
            className="inline-flex items-center rounded border border-gray-400 bg-transparent px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            সকল
          </Link>
        </div>
      </div>
    </div>
  );
}

export default TopBanner;
