import { fetchNotices } from "@/queries/notice.queries";
import Link from "next/link";

export async function TopBanner() {
  const data = await fetchNotices(5);
  const duration = 5 * (data?.length ?? 0);
  return (
    <div
      className="w-full mt-2 bg-gray-50 border-t border-b border-gray-100"
      aria-hidden={false}
    >
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
      `}</style>

      <div className="max-w-6xl mx-auto px-4 py-1 flex items-center justify-between gap-3">
        <div className="flex-1 overflow-hidden">
          {!data ? (
            <span className="text-gray-500 text-sm leading-6">
              কোনো নোটিশ নেই
            </span>
          ) : (
            <div
              className="marquee-track text-sm leading-6"
              style={{ animationDuration: `${duration}s`, animationDelay: '5s' }}
            >
              {data.map((notice, i) => (
                <a
                  key={i}
                  href={notice.file || "#"}
                  target="_blank"
                  rel="noreferrer"
                  title={notice.title || ""}
                  className="text-gray-900 hover:text-blue-600 mr-5 before:content-['▶'] before:mr-1 before:font-bold before:text-xs before:text-[#609513]"
                > {notice.title}
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0">
          <Link
            href={"/notices"}
            className="inline-flex items-center px-3 py-1.5 border border-gray-400 text-gray-700 rounded text-sm bg-transparent hover:bg-gray-50"
            aria-label="show-all"
          >
            সকল
          </Link>
        </div>
      </div>
    </div>
  );
};

export default TopBanner;