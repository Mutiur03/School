import * as React from "react";
import "./RightSidebar.css";
import { Link, useLocation } from "react-router-dom";

import { useHeadMasterMsg } from "../data";
import { useSchoolConfig } from "../context/school";
import backend from "@/lib/backend";

type SidebarLink = {
  title: string;
  url?: string;
  image?: string;
};

type HeadMasterMsg = {
  head_message?: string;
  teacher?: {
    name?: string;
    image?: string;
  };
};

export type RightSidebarProps = {
  headMasterMsg?: HeadMasterMsg | null;
  backendBaseUrl?: string;
};

export function RightSidebar({ headMasterMsg }: RightSidebarProps) {
  const school = useSchoolConfig();
  const location = useLocation();

  const { data: headMasterMsgFromApi } = useHeadMasterMsg();
  const resolvedHeadMasterMsg = headMasterMsg ?? (headMasterMsgFromApi as any);

  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [imgLoading, setImgLoading] = React.useState(true);
  const [imgError, setImgError] = React.useState(false);
  const [headMsgShow, setHeadMsgShow] = React.useState(true);

  const monthNames = [
    "JANUARY",
    "FEBRUARY",
    "MARCH",
    "APRIL",
    "MAY",
    "JUNE",
    "JULY",
    "AUGUST",
    "SEPTEMBER",
    "OCTOBER",
    "NOVEMBER",
    "DECEMBER",
  ];

  React.useEffect(() => {
    setHeadMsgShow(location.pathname === "/" || location.pathname === "");
  }, [location.pathname]);
  const sidebarLinks = ((school as any).sidebarLinks ?? {}) as {
    important?: SidebarLink[];
    quick?: SidebarLink[];
    useful?: SidebarLink[];
    hotlines?: SidebarLink[];
  };

  const links = ((school as any).links ?? {}) as {
    teacherLogin?: string;
    studentLogin?: string;
  };

  const getCalendarData = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const today = new Date();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDayOfWeek = (firstDay.getDay() + 6) % 7;

    const daysInMonth = lastDay.getDate();
    const weeks: Array<Array<{ day: number; isToday: boolean } | null>> = [];
    let currentWeek: Array<{ day: number; isToday: boolean } | null> = [];

    for (let i = 0; i < startDayOfWeek; i++) {
      currentWeek.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const isToday =
        today.getFullYear() === year &&
        today.getMonth() === month &&
        today.getDate() === day;

      currentWeek.push({ day, isToday });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    while (currentWeek.length > 0 && currentWeek.length < 7) {
      currentWeek.push(null);
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return {
      monthYear: `${monthNames[month]} ${year}`,
      weeks,
      prevMonth: new Date(year, month - 1, 1),
      nextMonth: new Date(year, month + 1, 1),
    };
  };

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prevDate) => {
      const newDate = new Date(prevDate);
      if (direction === "prev") {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const calendarData = getCalendarData(currentDate);

  const teacherImage = resolvedHeadMasterMsg?.teacher?.image;
  const teacherImgSrc = `${backend}/${teacherImage ?? ""}`;

  return (
    <div className="content-right">
      {headMsgShow ? (
        <div className="sidebar-widget widget widget_text">
          <div className="widget-heading">
            <h3 className="widget-title">প্রধান শিক্ষকের বাণী</h3>
          </div>
          <div className="textwidget">
            <div className="headmaster-wrapper">
              {(!resolvedHeadMasterMsg || imgError) ? (
                <div
                  className="aligncenter headmaster-image"
                  role="status"
                  aria-live="polite"
                  style={{
                    background: "#ffffff",
                    width: "100%",
                    aspectRatio: "1 / 1",
                    display: "block",
                    position: "relative",
                    overflow: "hidden",
                    borderRadius: 8,
                    backgroundColor: "#f0f0f0",
                  }}
                />
              ) : (
                <div
                  className="aligncenter headmaster-image"
                  style={{
                    background: "#ffffff",
                    width: "100%",
                    aspectRatio: "1 / 1",
                    display: "block",
                    position: "relative",
                    overflow: "hidden",
                    borderRadius: 2,
                  }}
                >
                  <img
                    alt="image"
                    src={teacherImgSrc}
                    onLoad={() => setImgLoading(false)}
                    onError={() => {
                      setImgError(true);
                      setImgLoading(false);
                    }}
                    style={{
                      height: "auto",
                      width: "100%",
                      objectFit: "cover",
                      display: "block",
                      opacity: imgLoading ? 0 : 1,
                      transition: "opacity 200ms ease",
                    }}
                  />
                </div>
              )}
            </div>
            <p>
              <Link className="more-link" to="/message-from-head/">
                View Details →
              </Link>
            </p>
          </div>
        </div>
      ) : null}

      <div className="sidebar-widget widget widget_nav_menu">
        <div className="widget-heading">
          <h3 className="widget-title">Important Links</h3>
        </div>
        <div className="menu-important-links-container">
          <ul className="menu">
            {(sidebarLinks.important ?? []).map((link, idx) => (
              <li key={idx} className="menu-item">
                <a href={link.url}>{link.title}</a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="sidebar-widget widget widget_nav_menu">
        <div className="widget-heading">
          <h3 className="widget-title">Quick Links</h3>
        </div>
        <div className="menu-quick-links-container">
          <ul className="menu">
            {(sidebarLinks.quick ?? []).map((link, idx) => (
              <li key={idx} className="menu-item">
                <a target="_blank" href={link.url} rel="noreferrer">
                  {link.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="sidebar-widget widget widget_nav_menu">
        <div className="widget-heading">
          <h3 className="widget-title">Sidebar Menu</h3>
        </div>
        <div className="menu-sidebar-menu-container">
          <ul className="menu">
            <li className="menu-item">
              <a target="_blank" href={links.teacherLogin} rel="noreferrer">
                Teacher Log in
              </a>
            </li>
            <li className="menu-item">
              <a target="_blank" href={links.studentLogin} rel="noreferrer">
                Student Log in
              </a>
            </li>
            <li className="menu-item">
              <a target="_blank" rel="noreferrer">
                e-Payment
              </a>
            </li>
            <li className="menu-item">
              <a target="_blank" rel="noreferrer">
                e-Library
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="sidebar-widget widget widget_nav_menu">
        <div className="widget-heading">
          <h3 className="widget-title">Useful Links</h3>
        </div>
        <div className="menu-useful-links-container">
          <ul className="menu">
            {(sidebarLinks.useful ?? []).map((link, idx) => (
              <li key={idx} className="menu-item">
                <a target="_blank" href={link.url} rel="noreferrer">
                  {link.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="sidebar-widget widget widget_calendar">
        <div className="widget-heading">
          <h3 className="widget-title">Calendar</h3>
        </div>
        <div className="calendar_wrap">
          <table className="wp-calendar-table">
            <caption>{calendarData.monthYear}</caption>
            <thead>
              <tr>
                <th scope="col" aria-label="Monday">M</th>
                <th scope="col" aria-label="Tuesday">T</th>
                <th scope="col" aria-label="Wednesday">W</th>
                <th scope="col" aria-label="Thursday">T</th>
                <th scope="col" aria-label="Friday">F</th>
                <th scope="col" aria-label="Saturday">S</th>
                <th scope="col" aria-label="Sunday">S</th>
              </tr>
            </thead>
            <tbody>
              {calendarData.weeks.map((week, weekIndex) => (
                <tr key={weekIndex}>
                  {week.map((day, dayIndex) => (
                    <td key={dayIndex} className={day?.isToday ? "today" : ""}>
                      {day ? day.day : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <nav
            aria-label="Previous and next months"
            className="wp-calendar-nav flex justify-between"
          >
            <span className="wp-calendar-nav-prev">
              <button
                onClick={() => navigateMonth("prev")}
                style={{
                  background: "none",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                « {monthNames[calendarData.prevMonth.getMonth()].slice(0, 3)}
              </button>
            </span>
            <span className="wp-calendar-nav-next">
              <button
                onClick={() => navigateMonth("next")}
                style={{
                  background: "none",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                {monthNames[calendarData.nextMonth.getMonth()].slice(0, 3)} »
              </button>
            </span>
          </nav>
        </div>
      </div>

      <div className="sidebar-widget widget widget_text">
        <div className="widget-heading">
          <h3 className="widget-title">জরুরি হটলাইন</h3>
        </div>
        <div className="textwidget">
          <p>
            {(sidebarLinks.hotlines ?? []).map((hotline, idx) => (
              <img
                key={idx}
                loading="lazy"
                decoding="async"
                className="aligncenter"
                src={String(hotline.image ?? "")}
                alt={hotline.title}
              />
            ))}
          </p>
        </div>
      </div>
    </div>
  );
}
