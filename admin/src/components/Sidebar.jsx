/* eslint-disable no-unused-vars */
import { useEffect, useState, useRef } from "react";
import {
  FaHome,
  FaUser,
  FaChevronDown,
  FaClipboardList,
  FaChevronLeft,
  FaChevronRight,
  FaUsers,
  FaCogs,
} from "react-icons/fa";
import {
  FaGear,
  FaRegImage,
  FaCalendarCheck,
  FaBullhorn,
} from "react-icons/fa6";

import { motion, AnimatePresence } from "framer-motion";
import { useLocation, NavLink } from "react-router-dom";
import {
  Megaphone,
  Calendar,
  Image,
  CalendarClock,
  TreePalm,
  ChevronDown,
} from "lucide-react";

const Sidebar = ({
  sidebarExpanded,
  setSidebarExpanded,
  open = false,
  onClose,
  navbarRef,
}) => {
  const location = useLocation();
  const sidebarRef = useRef(null);

  const sidebarItems = [
    {
      label: "Dashboard",
      icon: FaHome,
      dropdown: false,
      link: "/dashboard",
      id: "dashboard",
    },
    {
      label: "Student",
      icon: FaUsers,
      dropdown: true,
      id: "student",
      link: "/students",
      items: [
        {
          label: "Student List",
          link: "/students/student-list",
          id: "student-list",
        },
        {
          label: "Alumni List",
          link: "/students/alumni-list",
          id: "alumni-list",
        },
      ],
    },
    {
      label: "Teacher",
      icon: FaUser,
      dropdown: true,
      id: "teacher",
      items: [
        {
          label: "Teacher List",
          link: "/teachers/list",
          id: "teachers",
        },
        {
          label: "Assigned Teachers",
          link: "/teachers/assigned-teachers",
          id: "assignments",
        },
      ],
    },
    {
      label: "Results",
      icon: FaClipboardList,
      dropdown: true,
      id: "reports",
      items: [
        {
          label: "Add Marks",
          link: "/result/add-marks",
          id: "add-marks",
        },
        {
          label: "View Result",
          link: "/result/view-marks",
          id: "view-marks",
        },
        {
          label: "Generate Result",
          link: "/result/generate-result",
          id: "generate-result",
        },
        {
          label: "Customize Result",
          link: "/result/customize-result",
          id: "customize-result",
        },
      ],
    },
    {
      label: "Settings",
      icon: FaGear,
      dropdown: true,
      id: "settings",
      items: [
        // {
        //   label: "Add New Student",
        //   link: "/settings/add-new-student",
        //   id: "add-new-student",
        // },
        // {
        //   label: "Add New Teacher",
        //   link: "/settings/add-new-teacher",
        //   id: "add-new-teacher",
        // },
        // {
        //   label: "Add Number",
        //   link: "/settings/add-number",
        //   id: "add-number",
        // },
        {
          label: "Add Subject",
          link: "/settings/add-subject",
          id: "add-subject",
        },
        // {
        //   label: "Add New Level",
        //   link: "/settings/add-new-level",
        //   id: "add-new-level",
        // },
        {
          label: "Add Exam",
          link: "/settings/add-exam",
          id: "add-exam",
        },
      ],
    },
    {
      label: "Attendence",
      icon: Calendar,
      dropdown: false,
      link: "/attendence",
      id: "attendance",
    },
    {
      label: "Notice",
      icon: FaBullhorn,
      dropdown: false,
      link: "/notice",
      id: "notice",
    },
    {
      label: "Holiday",
      icon: TreePalm,
      dropdown: false,
      link: "/holiday",
      id: "holiday",
    },
    {
      label: "Events",
      icon: CalendarClock,
      dropdown: false,
      link: "/events",
      id: "events",
    },
    {
      label: "Gallery",
      icon: FaRegImage,
      dropdown: true,
      id: "gallery",
      items: [
        {
          label: "Upload Image",
          link: "/gallery/upload",
          id: "upload-image",
        },
        {
          label: "Aprrove Image",
          link: "/gallery/pending",
          id: "approve-image",
        },
        {
          label: "Rejected Image",
          link: "/gallery/rejected",
          id: "rejected-image",
        },
      ],
    },
  ];

  const [openDropdown, setOpenDropdown] = useState(null);

  useEffect(() => {
    const updateSize = () => {
      if (window.innerWidth >= 768) {
        setSidebarExpanded(true);
      } else {
        setSidebarExpanded(open);
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [open, setSidebarExpanded]);

  useEffect(() => {
    const currentPath = location.pathname;
    let foundActive = false;

    for (const item of sidebarItems) {
      if (item.link === currentPath) {
        foundActive = true;
        break;
      }

      if (item.items) {
        for (const subItem of item.items) {
          if (subItem.link === currentPath) {
            setOpenDropdown(item.id);
            foundActive = true;
            break;
          }
        }
        if (foundActive) break;
      }
    }
  }, [location.pathname]);
  useEffect(() => {
    const handleClickOutside = (event) => {
      const target = event.target;
      const clickedInsideSidebar =
        sidebarRef.current && sidebarRef.current.contains(target);
      const clickedInsideNavbar =
        navbarRef?.current && navbarRef.current.contains(target);
      if (!clickedInsideSidebar && !clickedInsideNavbar) {
        if (window.innerWidth < 768 && open && onClose) {
          onClose();
        }
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, onClose, navbarRef]);

  const toggleDropdown = (dropdownId) => {
    console.log("Toggling:", dropdownId);
    if (sidebarExpanded) {
      setOpenDropdown(openDropdown === dropdownId ? null : dropdownId);
    } else {
      setSidebarExpanded(true);
    }
  };

  return (
    <>
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: sidebarExpanded ? "250px" : "64px",
          // Only slide in/out on mobile (width < 768px)
          left: window.innerWidth < 768 ? (open ? "0" : "-260px") : "0",
        }}
        ref={sidebarRef}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={`fixed h-[calc(100vh-3.5rem)] flex bg-sidebar  flex-col z-50 border-r border-border shadow-xl`}
      >
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {/* Add height constraints here */}
            <div className="scrollbar min-h-full [&::-webkit-scrollbar]:hidden scrollbar-hide">
              <div className="flex-1 overflow-x-hidden h-[calc(100vh-4rem)] py-4 scrollbar-thin [&::-webkit-scrollbar]:hidden scrollbar-hide">
                <ul className="space-y-1 px-2">
                  {sidebarItems.map((item) => (
                    <li key={item.id}>
                      {!item.dropdown ? (
                        <NavLink
                          to={item.link}
                          className={({ isActive }) =>
                            `flex items-center w-full px-3 py-2 rounded-md transition-all duration-200 ${
                              isActive
                                ? "bg-accent text-accent-foreground"
                                : "hover:inset-1 hover:inset-ring"
                            } ${sidebarExpanded ? "gap-3" : "justify-center"}`
                          }
                          onClick={() => {
                            console.log(item);
                            // closeMobileSidebar();
                            setOpenDropdown(null);
                          }}
                        >
                          <item.icon className="flex-shrink-0 h-4 w-4 text-lg" />
                          {sidebarExpanded && (
                            <motion.span
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="whitespace-nowrap overflow-hidden text-ellipsis"
                            >
                              {item.label}
                            </motion.span>
                          )}
                        </NavLink>
                      ) : (
                        <div>
                          <button
                            className={`flex items-center w-full p-3 rounded-md transition-all duration-200 ${
                              sidebarExpanded
                                ? "justify-between gap-3"
                                : "justify-center"
                            }`}
                            onClick={() => toggleDropdown(item.id)}
                          >
                            <div
                              className={`flex items-center ${
                                sidebarExpanded ? "gap-3" : ""
                              }`}
                            >
                              <item.icon className="flex-shrink-0 h-4 w-4 text-lg" />
                              {sidebarExpanded && (
                                <motion.span
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  className="whitespace-nowrap overflow-hidden text-ellipsis text-left"
                                >
                                  {item.label}
                                </motion.span>
                              )}
                            </div>
                            {sidebarExpanded && (
                              <motion.div
                                animate={{
                                  rotate: openDropdown === item.id ? 180 : 0,
                                }}
                                transition={{ duration: 0.2 }}
                              >
                                <ChevronDown className="text-xs" />
                              </motion.div>
                            )}
                          </button>

                          {sidebarExpanded && (
                            <AnimatePresence>
                              {openDropdown === item.id && (
                                <motion.ul
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{
                                    height: "auto",
                                    opacity: 1,
                                    transition: { duration: 0.2 },
                                  }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-visible space-y-1 pl-9"
                                >
                                  {item.items.map((subItem) => (
                                    <li key={subItem.id}>
                                      <NavLink
                                        to={subItem.link}
                                        className={({ isActive }) =>
                                          `flex items-center w-full px-3 py-2 rounded-md transition-all duration-200 ${
                                            isActive
                                              ? "bg-accent text-accent-foreground"
                                              : "hover:inset-1 hover:inset-ring"
                                          }`
                                        }
                                        onClick={() => {
                                          console.log(subItem);
                                          // closeMobileSidebar();
                                        }}
                                      >
                                        <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                                          {subItem.label}
                                        </span>
                                      </NavLink>
                                    </li>
                                  ))}
                                </motion.ul>
                              )}
                            </AnimatePresence>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  );
};

export default Sidebar;
