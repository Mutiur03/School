import "./NoticeBoard.css";
import Link from "next/link";
import { getFileUrl } from "@/lib/backend";
import { fetchNotices } from "@/queries/notice.queries";

export async function NoticeBoard() {
  const data = await fetchNotices(5);
  return (
    <div className="front-notices-area ">
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
