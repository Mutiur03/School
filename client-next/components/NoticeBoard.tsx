import "./NoticeBoard.css";
import { ClientNoticeDebug } from "@/components/ClientNoticeDebug";
import Link from "next/link";
import backend, { getFileUrl } from "@/lib/backend";
import { buildNoticesUrl, fetchNotices } from "@/queries/notice.queries";

export async function NoticeBoard() {
  const data = await fetchNotices(5);
  const requestUrl = buildNoticesUrl(5);
  return (
    <div className="front-notices-area ">
      <ClientNoticeDebug
        label="home NoticeBoard"
        notices={data ?? []}
        backend={backend}
        limit={5}
      />
      <p className="notice-debug-route">
        SSR route: {requestUrl ?? "API_URL missing"}
      </p>
      <div className="notices-front">
        <div className="notices-front-board">
          <div className="notices-items">
            <h2>Notice Board</h2>
            <ul className="notices_front_list">
              {(data ?? []).map((notice, index) => (
                <li key={index} className="notice-item text-left">
                  <div className="notice-title">
                    <h5>
                      <a
                        href={getFileUrl(notice.file) ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {notice.title}
                      </a>
                    </h5>
                  </div>
                </li>
              ))}
            </ul>
            <h4 className="text-right">
              <Link href="/notices">View All</Link>
            </h4>
          </div>
        </div>
      </div>
    </div>
  );
}
