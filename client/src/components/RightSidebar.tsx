import "./RightSidebar.css";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { schoolConfig } from "@/lib/info";
import { useHeadMasterMsg } from "@/hooks/useSchoolData";
import backend from "@/lib/backend";

function RightSidebar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { data: headMasterMsg } = useHeadMasterMsg();
  const [imgLoading, setImgLoading] = useState(true);
  const [imgError, setImgError] = useState(false);
  const [head_msg_show, setHeadMsg] = useState(true);
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
  const location = useLocation();

  useEffect(() => {
    setHeadMsg(location.pathname === "/" || location.pathname === "");
  }, [location.pathname]);
  const getCalendarData = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const today = new Date();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDayOfWeek = (firstDay.getDay() + 6) % 7;

    const daysInMonth = lastDay.getDate();
    const weeks = [];
    let currentWeek = [];

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

  return (
    <div className="content-right">
      {head_msg_show && (
        <div className="sidebar-widget widget widget_text">
          <div className="widget-heading">
            <h3 className="widget-title">প্রধান শিক্ষকের বাণী</h3>
          </div>
          <div className="textwidget">
            <div className="headmaster-wrapper">
              {(!headMasterMsg || imgError) && (
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
              )}
              {headMasterMsg && !imgError && (
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
                    src={`${backend}/${headMasterMsg.teacher.image}`}
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
      )}

      {/* Important Links Widget */}
      <div className="sidebar-widget widget widget_nav_menu">
        <div className="widget-heading">
          <h3 className="widget-title">Important Links</h3>
        </div>
        <div className="menu-important-links-container">
          <ul className="menu">
            {schoolConfig.sidebarLinks.important.map((link, idx) => (
              <li key={idx} className="menu-item">
                <a href={link.url}>{link.title}</a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Quick Links Widget */}
      <div className="sidebar-widget widget widget_nav_menu">
        <div className="widget-heading">
          <h3 className="widget-title">Quick Links</h3>
        </div>
        <div className="menu-quick-links-container">
          <ul className="menu">
            {schoolConfig.sidebarLinks.quick.map((link, idx) => (
              <li key={idx} className="menu-item">
                <a target="_blank" href={link.url}>
                  {link.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Sidebar Menu Widget */}
      <div className="sidebar-widget widget widget_nav_menu">
        <div className="widget-heading">
          <h3 className="widget-title">Sidebar Menu</h3>
        </div>
        <div className="menu-sidebar-menu-container">
          <ul className="menu">
            <li className="menu-item">
              <a target="_blank" href={schoolConfig.links.teacherLogin}>
                Teacher Log in
              </a>
            </li>
            {/* <li className="menu-item">
                            <Link to="/teacher-list">Teacher List</Link>
                        </li> */}
            <li className="menu-item">
              <a target="_blank" href={schoolConfig.links.studentLogin}>
                Student Log in
              </a>
            </li>
            <li className="menu-item">
              <a target="_blank">e-Payment</a>
            </li>
            <li className="menu-item">
              <a target="_blank">e-Library</a>
            </li>
            {/* <li className="menu-item">
                            <a target="_blank" >College Mates</a>
                        </li> */}
          </ul>
        </div>
      </div>

      {/* Useful Links Widget */}
      <div className="sidebar-widget widget widget_nav_menu">
        <div className="widget-heading">
          <h3 className="widget-title">Useful Links</h3>
        </div>
        <div className="menu-useful-links-container">
          <ul className="menu">
            {schoolConfig.sidebarLinks.useful.map((link, idx) => (
              <li key={idx} className="menu-item">
                <a target="_blank" href={link.url}>
                  {link.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Calendar Widget */}
      <div className="sidebar-widget widget widget_calendar">
        <div className="widget-heading">
          <h3 className="widget-title">Calendar</h3>
        </div>
        <div className="calendar_wrap">
          <table className="wp-calendar-table">
            <caption>{calendarData.monthYear}</caption>
            <thead>
              <tr>
                <th scope="col" aria-label="Monday">
                  M
                </th>
                <th scope="col" aria-label="Tuesday">
                  T
                </th>
                <th scope="col" aria-label="Wednesday">
                  W
                </th>
                <th scope="col" aria-label="Thursday">
                  T
                </th>
                <th scope="col" aria-label="Friday">
                  F
                </th>
                <th scope="col" aria-label="Saturday">
                  S
                </th>
                <th scope="col" aria-label="Sunday">
                  S
                </th>
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

      {/* জরুরি হটলাইন Widget */}
      <div className="sidebar-widget widget widget_text">
        <div className="widget-heading">
          <h3 className="widget-title">জরুরি হটলাইন</h3>
        </div>
        <div className="textwidget">
          <p>
            {schoolConfig.sidebarLinks.hotlines.map((hotline, idx) => (
              <img
                key={idx}
                loading="lazy"
                decoding="async"
                className="aligncenter"
                src={hotline.image}
                alt={hotline.title}
              />
            ))}
          </p>
        </div>
      </div>

      {/* একদেশ Widget */}
      {/* <div className="sidebar-widget widget widget_text">
                <div className="widget-heading">
                    <h3 className="widget-title">একদেশ</h3>
                </div>
                <div className="textwidget">
                    <p>
                        <a href="http://ekdesh.ekpay.gov.bd/">
                            <img
                                loading="lazy"
                                decoding="async"
                                className="aligncenter"
                                src="/ekdesh.jpg"
                                alt="একদেশ"
                            />
                        </a>
                    </p>
                </div>
            </div> */}

      {/* ডেঙ্গু প্রতিরোধে করণীয় Widget */}
      {/* <div className="sidebar-widget widget widget_text">
                <div className="widget-heading">
                    <h3 className="widget-title">ডেঙ্গু প্রতিরোধে করণীয়</h3>
                </div>
                <div className="textwidget">
                    <p>
                        <a href="https://bangladesh.gov.bd/site/page/91530698-c795-4542-88f2-5da1870bd50c">
                            <img
                                loading="lazy"
                                decoding="async"
                                className="aligncenter"
                                src="/dengu.jpg"
                                alt="ডেঙ্গু প্রতিরোধ"
                            />
                        </a>
                    </p>
                </div>
            </div> */}
    </div>
  );
}

export default RightSidebar;
