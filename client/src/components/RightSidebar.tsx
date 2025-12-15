import axios from 'axios'
import './RightSidebar.css'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom';

function RightSidebar() {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [head, setHead] = useState<string>('');
    const [imgLoading, setImgLoading] = useState(true);
    const [imgError, setImgError] = useState(false);
    const [head_msg_show, setHeadMsg] = useState(true)
    const monthNames = [
        'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
        'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
    ]
    const location = useLocation();

    useEffect(() => {
        setHeadMsg(location.pathname === '/' || location.pathname === '');
    }, [location.pathname]
    )
    const host = import.meta.env.VITE_BACKEND_URL;
    const getCalendarData = (date: Date) => {
        const year = date.getFullYear()
        const month = date.getMonth()
        const today = new Date()

        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)

        const startDayOfWeek = (firstDay.getDay() + 6) % 7

        const daysInMonth = lastDay.getDate()
        const weeks = []
        let currentWeek = []

        for (let i = 0; i < startDayOfWeek; i++) {
            currentWeek.push(null)
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const isToday = today.getFullYear() === year &&
                today.getMonth() === month &&
                today.getDate() === day

            currentWeek.push({ day, isToday })

            if (currentWeek.length === 7) {
                weeks.push(currentWeek)
                currentWeek = []
            }
        }

        while (currentWeek.length > 0 && currentWeek.length < 7) {
            currentWeek.push(null)
        }
        if (currentWeek.length > 0) {
            weeks.push(currentWeek)
        }

        return {
            monthYear: `${monthNames[month]} ${year}`,
            weeks,
            prevMonth: new Date(year, month - 1, 1),
            nextMonth: new Date(year, month + 1, 1)
        }
    }

    const navigateMonth = (direction: 'prev' | 'next') => {
        setCurrentDate(prevDate => {
            const newDate = new Date(prevDate)
            if (direction === 'prev') {
                newDate.setMonth(newDate.getMonth() - 1)
            } else {
                newDate.setMonth(newDate.getMonth() + 1)
            }
            return newDate
        })
    }

    const calendarData = getCalendarData(currentDate)
    useEffect(() => {
        setImgLoading(true);
        setImgError(false);
        let cancelled = false;
        axios.get('/api/teachers/get_head_msg')
            .then(response => {
                if (cancelled) return;
                const imagePath = response?.data?.teacher?.image || '';
                if (imagePath) {
                    setHead(imagePath);
                    setImgLoading(true);
                } else {
                    setHead('');
                    setImgLoading(false);
                }
            })
            .catch(error => {
                if (cancelled) return;
                console.error('Error fetching head message:', error);
                setHead('');
                setImgLoading(false);
            });
        return () => { cancelled = true; }
    }, [])

    return (
        <div className="content-right">

            {head_msg_show && (
                <div className="sidebar-widget widget widget_text">
                    <div className="widget-heading">
                        <h3 className="widget-title">প্রধান শিক্ষকের বাণী</h3>
                    </div>
                    <div className="textwidget">
                        <div className="headmaster-wrapper">
                            {(!head || imgError) && (
                                <div
                                    className="aligncenter headmaster-image"
                                    role="status"
                                    aria-live="polite"
                                    style={{
                                        background: '#ffffff',
                                        width: '100%',
                                        aspectRatio: '1 / 1',
                                        display: 'block',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        borderRadius: 8,
                                        backgroundColor: '#f0f0f0'
                                    }}
                                />
                            )}
                            {head && !imgError && (
                                <div
                                    className="aligncenter headmaster-image"
                                    style={{
                                        background: '#ffffff',
                                        width: '100%',
                                        aspectRatio: '1 / 1',
                                        display: 'block',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        borderRadius: 8
                                    }}
                                >
                                    <img
                                        src={
                                            head && /^(https?:)?\//.test(head)
                                                ? head
                                                : `${host?.replace(/\/$/, '') || ''}/${head.replace(/^\//, '')}`
                                        }
                                        alt="প্রধান শিক্ষক"
                                        onLoad={() => {
                                            setImgLoading(false);
                                            setImgError(false);
                                        }}
                                        onError={() => {
                                            setHead('');
                                            setImgLoading(false);
                                            setImgError(true);
                                        }}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            display: 'block',
                                            opacity: imgLoading ? 0 : 1,
                                            transition: 'opacity 200ms ease'
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
                        <li className="menu-item">
                            <a href="http://rajshahieducationboard.gov.bd/">
                                Rajshahi Education Board
                            </a>
                        </li>
                        <li className="menu-item">
                            <a href="http://www.dshe.gov.bd/">
                                Directorate of Education
                            </a>
                        </li>
                        <li className="menu-item">
                            <a href="http://nu.ac.bd/">National University</a>
                        </li>
                        <li className="menu-item">
                            <a href="http://www.ru.ac.bd/">Rajshahi University</a>
                        </li>
                        <li className="menu-item">
                            <a href="http://www.bangladesh.gov.bd/">
                                National Web Portal
                            </a>
                        </li>
                        <li className="menu-item">
                            <a href="http://www.rajshahidiv.gov.bd/">
                                Rajshahi Division Portal
                            </a>
                        </li>
                        <li className="menu-item">
                            <a href="http://www.erajshahi.gov.bd/">
                                Rajshahi City Corporation
                            </a>
                        </li>
                        <li className="menu-item">
                            <a href="http://www.rajshahi.gov.bd/">
                                Rajshahi District Portal
                            </a>
                        </li>
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
                        <li className="menu-item">
                            <a target="_blank" href="http://www.pmo.gov.bd/">
                                প্রধানমন্ত্রীর কার্যালয়
                            </a>
                        </li>
                        <li className="menu-item">
                            <a target="_blank" href="http://www.bangabhaban.gov.bd/">
                                রাষ্ট্রপতির কার্যালয়
                            </a>
                        </li>
                        <li className="menu-item">
                            <a target="_blank" href="http://www.cabinet.gov.bd/">
                                মন্ত্রিপরিষদ বিভাগ
                            </a>
                        </li>
                        <li className="menu-item">
                            <a target="_blank" href="http://www.mopa.gov.bd/">
                                জনপ্রশাসন মন্ত্রণালয়
                            </a>
                        </li>
                        <li className="menu-item">
                            <a target="_blank" href="http://www.mof.gov.bd/en/">
                                অর্থ মন্ত্রণালয়
                            </a>
                        </li>
                        <li className="menu-item">
                            <a target="_blank" href="http://www.bangladesh.gov.bd/">
                                জাতীয় পোর্টাল
                            </a>
                        </li>
                        <li className="menu-item">
                            <a target="_blank" href="http://www.moedu.gov.bd/">
                                শিক্ষা মন্ত্রণালয়
                            </a>
                        </li>
                        <li className="menu-item">
                            <a target="_blank" href="http://dshe.gov.bd/">
                                মাধ্যমিক ও উচ্চশিক্ষা অধিদপ্তর
                            </a>
                        </li>
                        <li className="menu-item">
                            <a target="_blank" href="http://naem.gov.bd/">
                                জাতীয় শিক্ষা ব্যবস্থাপনা একাডেমি (নায়েম)
                            </a>
                        </li>
                        <li className="menu-item">
                            <a target="_blank" href="http://www.banbeis.gov.bd/">
                                বাংলাদেশ শিক্ষাতথ্য ও পরিসংখ্যান ব্যুরো (ব্যানবেইস)
                            </a>
                        </li>
                        <li className="menu-item">
                            <a href="https://www.nothi.gov.bd/">ই-নথি</a>
                        </li>
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
                            <a target="_blank" href="https://teacher.lbphs.gov.bd/">
                                Teacher Log in
                            </a>
                        </li>
                        {/* <li className="menu-item">
                            <Link to="/teacher-list">Teacher List</Link>
                        </li> */}
                        <li className="menu-item">
                            <a target="_blank" href="https://student.lbphs.gov.bd/">Student Log in</a>
                        </li>
                        <li className="menu-item">
                            <a target="_blank" >e-Payment</a>
                        </li>
                        <li className="menu-item">
                            <a target="_blank" >e-Library</a>
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
                        <li className="menu-item">
                            <a target="_blank" href="http://www.bangladesh.gov.bd/">
                                National Web Portal
                            </a>
                        </li>
                        <li className="menu-item">
                            <a target="_blank" href="https://www.nu.ac.bd">
                                National University
                            </a>
                        </li>
                        <li className="menu-item">
                            <a target="_blank" href="https://www.jessoreboard.gov.bd">
                                Education Board, Jashore
                            </a>
                        </li>
                        <li className="menu-item">
                            <a target="_blank" href="https://www.eshikkha.net">
                                e-Shikhha
                            </a>
                        </li>
                        <li className="menu-item">
                            <a target="_blank" href="https://www.muktopaath.gov.bd">
                                Muktopaath
                            </a>
                        </li>
                        <li className="menu-item">
                            <a target="_blank" href="https://www.teachers.gov.bd">
                                Shikkhak Batayon
                            </a>
                        </li>
                        <li className="menu-item">
                            <a target="_blank" href="https://eksheba.gov.bd">
                                eksheba
                            </a>
                        </li>
                        <li className="menu-item">
                            <a target="_blank" href="http://emis.gov.bd">
                                EMIS | DSHE
                            </a>
                        </li>
                        <li className="menu-item">
                            <a target="_blank" href="http://www.payfixation.gov.bd">
                                Integrated Budget And Accounting System
                            </a>
                        </li>
                        <li className="menu-item">
                            <a target="_blank" href="https://ibas.finance.gov.bd">
                                IBAS++ Version Selector
                            </a>
                        </li>
                        <li className="menu-item">
                            <a target="_blank" href="http://www.dip.gov.bd">
                                ইমিগ্রেশন ও পাসপোর্ট অধিদপ্তর
                            </a>
                        </li>
                        <li className="menu-item">
                            <a href="http://forms.mygov.bd/">বাংলাদেশ ফরম</a>
                        </li>
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
                                        <td key={dayIndex} className={day?.isToday ? 'today' : ''}>
                                            {day ? day.day : ''}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <nav aria-label="Previous and next months" className="wp-calendar-nav flex justify-between">
                        <span className="wp-calendar-nav-prev">
                            <button
                                onClick={() => navigateMonth('prev')}
                                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
                            >
                                « {monthNames[calendarData.prevMonth.getMonth()].slice(0, 3)}
                            </button>
                        </span>
                        <span className="wp-calendar-nav-next">
                            <button
                                onClick={() => navigateMonth('next')}
                                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
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
                        <img
                            loading="lazy"
                            decoding="async"
                            className="aligncenter"
                            src="/biwta.jpeg"
                            alt="Emergency Hotline"
                        />
                        <img
                            loading="lazy"
                            decoding="async"
                            className="aligncenter"
                            src="/National-Helpline.jpg"
                            alt="National Helpline"
                        />
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
    )
}

export default RightSidebar
