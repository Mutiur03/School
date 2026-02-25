import * as React from "react";
import "./NoticeBoard.css";
import { Link } from "react-router-dom";

export type NoticeBoardNotice = {
  title: string;
  file?: string;
};

export type NoticeBoardProps = {
  notices: NoticeBoardNotice[];
  isLoading?: boolean;
  viewAllPath?: string;
  title?: string;
  loadingText?: string;
};

export function NoticeBoard({
  notices,
  isLoading = false,
  viewAllPath = "/notices",
  title = "Notice Board",
  loadingText = "Loading notices...",
}: NoticeBoardProps) {
  return (
    <div className="front-notices-area ">
      <div className="notices-front">
        <div className="notices-front-board">
          <div className="notices-items">
            <h2>{title}</h2>
            {isLoading ? (
              <p>{loadingText}</p>
            ) : (
              <ul className="notices_front_list">
                {(notices ?? []).map((notice, index) => (
                  <li key={index} className="notice-item text-left">
                    <div className="notice-title">
                      <h5>
                        <a
                          href={notice.file ?? "#"}
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
            )}
            <h4 className="text-right">
              <Link to={viewAllPath}>View All</Link>
            </h4>
          </div>
        </div>
      </div>
    </div>
  );
}
