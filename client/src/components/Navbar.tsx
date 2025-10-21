import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import './Navbar.css'
import { Link } from 'react-router-dom'
import axios from 'axios'

interface SubDropdownItem {
    id: string
    href: string
    text: string
}

interface DropdownItem {
    id: string
    href: string
    text: string
    className?: string
    hasChildren?: boolean
    subDropdown?: SubDropdownItem[]
}

interface MenuItem {
    id: string
    className: string
    href: string
    text: string
    icon?: string
    isHome?: boolean
    dropdown?: DropdownItem[]
}

function Navbar() {
    const [isNavOpen, setIsNavOpen] = useState(false)
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
    const [routinePDF, setRoutinePDF] = useState<string | null>(null);
    useEffect(() => {
        axios.get("/api/class-routine/pdf")
            .then(res => setRoutinePDF(res.data[0].pdf_url || null))
            .catch(() => setRoutinePDF(null));
    }, []);

    const isExternalLink = (href?: string | null) => {
        if (!href) return false;
        try {
            const url = new URL(href, window.location.href);
            return url.origin !== window.location.origin;
        } catch {
            return /^(https?:|mailto:|tel:|\/\/)/i.test(href);
        }
    }

    const toggleNav = () => {
        setIsNavOpen(!isNavOpen)
        if (!isNavOpen) {
            setActiveDropdown(null)
        }
    }

    const toggleDropdown = (itemId: string) => {
        setActiveDropdown(activeDropdown === itemId ? null : itemId)
    }

    const closeNavbarIfMobile = (href?: string | null) => {
        const isRealHref = !!href && href.trim() !== '' && href.trim() !== '#';
        if (typeof window !== 'undefined' && window.innerWidth <= 768 && isRealHref) {
            setIsNavOpen(false);
            setActiveDropdown(null);
        }
    }

    const menuItems: MenuItem[] = [
        {
            id: "menu-item-3392",
            className: "nav_home menu-item menu-item-type-post_type menu-item-object-page menu-item-home current-menu-item page_item page-item-3390 current_page_item active menu-item-3392 nav-item",
            href: "/",
            text: "",
            icon: "fa fa-home",
            isHome: true
        },
        {
            id: "menu-item-3340",
            className: "nav_orange menu-item menu-item-type-post_type menu-item-object-page menu-item-has-children dropdown menu-item-3340 nav-item",
            href: "#",
            text: "About",
            dropdown: [
                { id: "menu-item-3342", href: "at-a-glance", text: "At a glance" },
                { id: "menu-item-3341", href: "at-a-glance", text: "Aims & Goals" },
                { id: "menu-item-3385", href: "gallery", text: "Photo Gallery" },
                { id: "menu-item-3348", href: "at-a-glance", text: "Seat Capacity" },
                // { id: "menu-item-3343", href: "#", text: "Hostel Info" }
            ]
        },
        {
            id: "menu-item-3349",
            className: "nav_red menu-item menu-item-type-post_type menu-item-object-page menu-item-has-children dropdown menu-item-3349 nav-item",
            href: "#",
            text: "Information",
            dropdown: [
                { id: "menu-item-3350", href: "#", text: "Administration" },
                // { id: "menu-item-3354", href: "#", text: "List of Headmaster" },
                // { id: "menu-item-3356", href: "#", text: "List of Assistant Headmaster" },
                { id: "menu-item-3657", href: "teacher-list", text: "Teacher List" },
                { id: "menu-item-3357", href: "staff-list", text: "Staff Info" },
                // { id: "menu-item-3353", href: "#", text: "Famous" },
                // { id: "menu-item-3351", href: "#", text: "Ex Students" },
                // { id: "menu-item-3352", href: "#", text: "Ex Teachers" }
            ]
        },
        // {
        //     id: "menu-item-3670",
        //     className: "nav_green menu-item menu-item-type-post_type menu-item-object-page menu-item-has-children dropdown menu-item-3670 nav-item",
        //     href: "#",
        //     text: "Departments",
        //     dropdown: [
        //         { id: "menu-item-3671", href: "#", text: "Department of Bangla" },
        //         { id: "menu-item-3708", href: "#", text: "Department of English" },
        //         { id: "menu-item-3707", href: "#", text: "Department of Mathematics" },
        //         { id: "menu-item-3706", href: "#", text: "Department of Social Science" },
        //         { id: "menu-item-3705", href: "#", text: "Department of Religion" },
        //         { id: "menu-item-3704", href: "#", text: "Department of Physics" },
        //         { id: "menu-item-3703", href: "#", text: "Department of Chemistry" },
        //         { id: "menu-item-3702", href: "#", text: "Department of Biology" },
        //         { id: "menu-item-3701", href: "#", text: "Department of Business Studies" },
        //         { id: "menu-item-3700", href: "#", text: "Department of Geography" },
        //         { id: "menu-item-3699", href: "#", text: "Department of Agriculture" },
        //         { id: "menu-item-3698", href: "#", text: "Department of Physical Education" },
        //         { id: "menu-item-3697", href: "#", text: "Department of Arts and Crafts" }
        //     ]
        // },
        {
            id: "menu-item-3358",
            className: "nav_purple menu-item menu-item-type-post_type menu-item-object-page menu-item-has-children dropdown menu-item-3358 nav-item",
            href: "#",
            text: "Activities",
            dropdown: [
                {
                    id: "menu-item-3360",
                    href: "#",
                    text: "Sports",
                    // hasChildren: true,
                    subDropdown: [
                        { id: "menu-item-3366", href: "#", text: "" },
                        { id: "menu-item-3361", href: "#", text: "Cultural activities" },
                    ]
                },
                { id: "menu-item-3368", href: "#", text: "Scout" },
                { id: "menu-item-3365", href: "#", text: "Red Crescent" },
                { id: "menu-item-3359", href: "#", text: "Cultural activities" },
                { id: "menu-item-3362", href: "#", text: "Debating club" },
            ]
        },
        {
            id: "menu-item-3370",
            className: "nav_green menu-item menu-item-type-post_type menu-item-object-page menu-item-has-children dropdown menu-item-3370 nav-item",
            href: "#",
            text: "Academic",
            dropdown: [
                { id: "menu-item-3374", href: "#", text: "Creative Learning" },
                { id: "menu-item-3376", href: "exam-routine", text: "Exam schedule" },
                { id: "menu-item-3371", href: `${routinePDF}`, text: "Academic Calender" },
                { id: "menu-item-3382", href: "#", text: "Vacation Calendar" },
                // { id: "menu-item-3381", href: "#", text: "Students Must Follow" },
                // { id: "menu-item-3372", href: "#", text: "School Time" },
                // { id: "menu-item-3373", href: "#", text: "School Uniform" },
                { id: "menu-item-3378", href: "#", text: "Library" },
                { id: "menu-item-3377", href: "#", text: "Laboratory" },
                // { id: "menu-item-3379", href: "#", text: "Physical Exercise" }
            ]
        },
        {
            id: "menu-item-3542",
            className: "nav_darkred menu-item menu-item-type-post_type menu-item-object-page menu-item-has-children dropdown menu-item-3542 nav-item",
            href: "#",
            text: "Notices",
            dropdown: [
                { id: "menu-item-3543", href: "notices", text: "Official Notices", className: "menu-item menu-item-type-taxonomy menu-item-object-cnotices-categories menu-item-3543 nav-item" },
                { id: "menu-item-3544", href: "events", text: "Events", className: "menu-item menu-item-type-taxonomy menu-item-object-cnotices-categories menu-item-3544 nav-item" },
                // { id: "menu-item-3545", href: "#", text: "NOC", className: "menu-item menu-item-type-taxonomy menu-item-object-cnotices-categories menu-item-3545 nav-item" },
                // { id: "menu-item-3546", href: "#", text: "Tender", className: "menu-item menu-item-type-taxonomy menu-item-object-cnotices-categories menu-item-3546 nav-item" }
            ]
        },
        {
            id: "menu-item-3540",
            className: "nav_orange menu-item menu-item-type-post_type menu-item-object-page menu-item-3540 nav-item",
            href: "#",
            text: "Registration",
            dropdown: [
                { id: "menu-item-3547", href: "reg/ssc", text: "Class Nine" },
                { id: "menu-item-3548", href: "", text: "Class Eight" },
                { id: "menu-item-3549", href: "", text: "Class Six" }
            ]
        },
        {
            id: "menu-item-3541",
            className: "nav_navyblue menu-item menu-item-type-post_type menu-item-object-page menu-item-3541 nav-item",
            href: "https://student.lbphs.gov.bd/",
            text: "Results"
        },
        {
            id: "menu-item-3386",
            className: "nav_purple menu-item menu-item-type-post_type menu-item-object-page menu-item-3386 nav-item",
            href: "#",
            text: "Admission"
        },
        {
            id: "menu-item-3384",
            className: "nav_orange menu-item menu-item-type-post_type menu-item-object-page menu-item-3384 nav-item",
            href: "at-a-glance",
            text: "Contact"
        }
    ]

    return (
        <nav
            id="site-navigation"
            // className="main-navigation navbar navbar-expand-md navbar-light row"
            role="navigation"
        >
            <div className="navbar-header">
                <button
                    className={`navbar-toggler ${isNavOpen ? 'active' : ''}`}
                    type="button"
                    onClick={toggleNav}
                    aria-controls="TF-Navbar"
                    aria-expanded={isNavOpen}
                    aria-label="Toggle navigation"
                >
                    <div className="hamburger-icon">
                        <span className="line line1"></span>
                        <span className="line line2"></span>
                        <span className="line line3"></span>
                    </div>
                </button>
            </div>
            <div
                id="TF-Navbar"
                className={`navbar-collapse col-md-12 ${isNavOpen ? 'show' : ''}`}
            >
                <ul id="primary-menu" className="nav navbar-nav primary-menu">
                    {menuItems.map((item) => (
                        <li key={item.id} id={item.id} className={`${item.className} ${activeDropdown === item.id ? 'show' : ''}`}>
                            {isExternalLink(item.href) && !item.dropdown ? (
                                <a
                                    href={item.href || '#'}
                                    className="nav-link hover:!text-white transition-colors duration-200 !flex !items-center !justify-center gap-1"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <span className="menu-text hover:!text-white">
                                        {item.isHome ? (
                                            <i className={`${item.icon} hover:!text-white`} aria-hidden="true"></i>
                                        ) : (
                                            item.text
                                        )}
                                    </span>
                                    {item.dropdown && (
                                        <span className="dropdown-icon !inline-flex !items-center">
                                            <ChevronDown size={14} />
                                        </span>
                                    )}
                                </a>
                            ) : (
                                <Link
                                    to={item.href || '#'}
                                    className="nav-link hover:!text-white transition-colors duration-200 !flex !items-center !justify-center gap-1"
                                    onClick={(e) => {
                                        if (item.dropdown) {
                                            e.preventDefault()
                                            toggleDropdown(item.id)
                                        }
                                    }}
                                >
                                    <span className="menu-text hover:!text-white">
                                        {item.isHome ? (
                                            <i className={`${item.icon} hover:!text-white`} aria-hidden="true"></i>
                                        ) : (
                                            item.text
                                        )}
                                    </span>
                                    {item.dropdown && (
                                        <span className="dropdown-icon !inline-flex !items-center">

                                            <ChevronDown size={14} />
                                        </span>
                                    )}
                                </Link>
                            )}

                            {item.dropdown && (
                                <ul className="dropdown-menu" role="menu">
                                    {item.dropdown.map((subItem) => (
                                        <li
                                            key={subItem.id}
                                            id={subItem.id}
                                            className={subItem.className || "menu-item menu-item-type-post_type menu-item-object-page nav-item"}
                                        >
                                            {isExternalLink(subItem.href) ? (
                                                <a
                                                    href={subItem.href || '#'}
                                                    className="dropdown-item hover:!text-white transition-colors duration-200"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={() => closeNavbarIfMobile(subItem.href)}
                                                >
                                                    <span className="menu-text hover:!text-white">{subItem.text}</span>
                                                    {subItem.hasChildren && (
                                                        <span className="dropdown-icon !inline-flex !items-center ml-1">
                                                            <ChevronDown size={14} />
                                                        </span>
                                                    )}
                                                </a>
                                            ) : (
                                                <Link
                                                    to={subItem.href || '#'}
                                                    className="dropdown-item hover:!text-white transition-colors duration-200"
                                                    onClick={() => closeNavbarIfMobile(subItem.href)}
                                                >
                                                    <span className="menu-text hover:!text-white">{subItem.text}</span>
                                                    {subItem.hasChildren && (
                                                        <span className="dropdown-icon !inline-flex !items-center ml-1">
                                                            <ChevronDown size={14} />
                                                        </span>
                                                    )}
                                                </Link>
                                            )}

                                            {subItem.subDropdown && (
                                                <ul className="dropdown-menu" role="menu">
                                                    {subItem.subDropdown.map((nestedItem) => (
                                                        <li
                                                            key={nestedItem.id}
                                                            id={nestedItem.id}
                                                            className="menu-item menu-item-type-post_type menu-item-object-page nav-item"
                                                        >
                                                            {isExternalLink(nestedItem.href) ? (
                                                                <a
                                                                    href={nestedItem.href || '#'}
                                                                    className="dropdown-item hover:!text-white transition-colors duration-200"
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    onClick={() => closeNavbarIfMobile(nestedItem.href)}
                                                                >
                                                                    <span className="menu-text hover:!text-white">{nestedItem.text}</span>
                                                                </a>
                                                            ) : (
                                                                <Link
                                                                    to={nestedItem.href || '#'}
                                                                    className="dropdown-item hover:!text-white transition-colors duration-200"
                                                                    onClick={() => closeNavbarIfMobile(nestedItem.href)}
                                                                >
                                                                    <span className="menu-text hover:!text-white">{nestedItem.text}</span>
                                                                </Link>
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </nav>
    )
}

export default Navbar
