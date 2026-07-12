import "./NoticeBoard.css";
import Link from "next/link";
import  { getFileUrl } from "@/lib/backend";
import {  fetchNotices } from "@/queries/notice.queries";

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
                    <a
                      href={getFileUrl(notice.file) ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {notice.title}
                    </a>
                  </div>
                </li>
              ))}
            </ul>
            <div className="notices-view-all text-right">
              <Link href="/notices">View All</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
