import { useEffect, useState, useRef } from "react";
import type { ForwardedRef } from "react";
import {
  FaHome,
  FaUser,
  FaClipboardList,
  FaUsers,
  FaCogs,
} from "react-icons/fa";
import {
  FaGear,
  FaRegImage,
  FaBullhorn,
} from "react-icons/fa6";

import { motion, AnimatePresence } from "framer-motion";
import { useLocation, NavLink } from "react-router-dom";
import {
  Megaphone,
  Calendar,
  CalendarClock,
  TreePalm,
  ChevronDown,
} from "lucide-react";
import { useUnifiedAuth } from "@/context/useUnifiedAuth";

interface SidebarProps {
  sidebarExpanded: boolean;
  setSidebarExpanded: (expanded: boolean) => void;
  open?: boolean;
  onClose?: () => void;
  navbarRef?: ForwardedRef<HTMLElement>;
}

interface SidebarItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  dropdown: boolean;
  link?: string;
  id: string;
  items?: {
    label: string;
    link: string;
    id: string;
  }[];
  roles?: ("admin" | "teacher" | "student")[];
}
const getRoutesByRole = (role: "admin" | "teacher" | "student") => {
  const adminRoutes: SidebarItem[] = [
    {
      label: "Dashboard",
      icon: FaHome,
      dropdown: false,
      link: "/admin/dashboard",
      id: "dashboard",
      roles: ["admin"],
    },
    {
      label: "Student",
      icon: FaUsers,
      dropdown: true,
      id: "student",
      link: "/admin/students",
      roles: ["admin"],
      items: [
        {
          label: "Student List",
          link: "/admin/students/student-list",
          id: "student-list",
        },
        {
          label: "Alumni List",
          link: "/admin/students/alumni-list",
          id: "alumni-list",
        },
      ],
    },
    {
      label: "Teacher",
      icon: FaUser,
      dropdown: true,
      id: "administration",
      roles: ["admin"],
      items: [
        {
          label: "Teacher List",
          link: "/admin/administration/teacher-list",
          id: "teachers",
        },
        {
          label: "Staff List",
          link: "/admin/administration/staff-list",
          id: "staff-list",
        },
        {
          label: "Assigned Teachers",
          link: "/admin/administration/assigned-teachers",
          id: "assignments",
        },
        {
          label: "Message From Head",
          link: "/admin/administration/head",
          id: "head-message",
        },
      ],
    },
    {
      label: "Results",
      icon: FaClipboardList,
      dropdown: true,
      id: "reports",
      roles: ["admin"],
      items: [
        {
          label: "Add Marks",
          link: "/admin/result/add-marks",
          id: "add-marks",
        },
        {
          label: "View Result",
          link: "/admin/result/view-marks",
          id: "view-marks",
        },
        {
          label: "Generate Result",
          link: "/admin/result/generate-result",
          id: "generate-result",
        },
        {
          label: "Customize Result",
          link: "/admin/result/customize-result",
          id: "customize-result",
        },
      ],
    },
    {
      label: "Registration",
      icon: FaCogs,
      dropdown: true,
      id: "registration",
      roles: ["admin"],
      items: [
        {
          label: "SSC Registration",
          link: "/admin/registration/ssc",
          id: "ssc-registration",
        },
      ],
    },
    {
      label: "Admission",
      icon: Megaphone,
      dropdown: true,
      id: "admission",
      roles: ["admin"],
      items: [
        {
          label: "Form",
          link: "/admin/admission/form",
          id: "admission-form",
        },
        {
          label: "Settings",
          link: "/admin/admission/settings",
          id: "admission-settings",
        },
        {
          label: "Result",
          link: "/admin/admission/result",
          id: "admission-result",
        },
      ],
    },
    {
      label: "Settings",
      icon: FaGear,
      dropdown: true,
      id: "settings",
      roles: ["admin"],
      items: [
        {
          label: "Subjects",
          link: "/admin/settings/add-subject",
          id: "add-subject",
        },
        {
          label: "Exam",
          link: "/admin/settings/add-exam",
          id: "add-exam",
        },
        {
          label: "Syllabus",
          link: "/admin/syllabus",
          id: "syllabus",
        },
        {
          label: "Class Routine",
          link: "/admin/classRoutine",
          id: "class-routine",
        },
        {
          label: "Citizen Charter",
          link: "/admin/citizencharter",
          id: "citizen-charter",
        },
      ],
    },
    {
      label: "Attendance",
      icon: Calendar,
      dropdown: false,
      link: "/admin/attendance",
      id: "attendance",
      roles: ["admin"],
    },
    {
      label: "SMS Management",
      icon: Megaphone,
      dropdown: false,
      link: "/admin/sms-management",
      id: "sms-management",
      roles: ["admin"],
    },
    {
      label: "Notice",
      icon: FaBullhorn,
      dropdown: false,
      link: "/admin/notice",
      id: "notice",
      roles: ["admin"],
    },
    {
      label: "Holiday",
      icon: TreePalm,
      dropdown: false,
      link: "/admin/holiday",
      id: "holiday",
      roles: ["admin"],
    },
    {
      label: "Events",
      icon: CalendarClock,
      dropdown: false,
      link: "/admin/events",
      id: "events",
      roles: ["admin"],
    },
    {
      label: "Gallery",
      icon: FaRegImage,
      dropdown: true,
      id: "gallery",
      roles: ["admin"],
      items: [
        {
          label: "Upload Image",
          link: "/admin/gallery/upload",
          id: "upload-image",
        },
        {
          label: "Aprrove Image",
          link: "/admin/gallery/pending",
          id: "approve-image",
        },
        {
          label: "Rejected Image",
          link: "/admin/gallery/rejected",
          id: "rejected-image",
        },
      ],
    },
  ];

  const teacherRoutes: SidebarItem[] = [
    {
      label: "Dashboard",
      icon: FaHome,
      dropdown: false,
      link: "/teacher/dashboard",
      id: "dashboard",
      roles: ["teacher"],
    },
    {
      label: "Attendance",
      icon: Calendar,
      dropdown: false,
      link: "/teacher/attendance",
      id: "attendance",
      roles: ["teacher"],
    },
    {
      label: "Mark Management",
      icon: FaClipboardList,
      dropdown: false,
      id: "mark-management",
      roles: ["teacher"],
      link: "/teacher/mark-management",
    },
    {
      label: "Settings",
      icon: FaCogs,
      dropdown: false,
      link: "/teacher/settings",
      id: "settings",
      roles: ["teacher"],
    }
  ];

  const studentRoutes: SidebarItem[] = [
    {
      label: "Dashboard",
      icon: FaHome,
      dropdown: false,
      link: "/student/dashboard",
      id: "dashboard",
      roles: ["student"],
    },
  ];

  const routesByRole = {
    admin: adminRoutes,
    teacher: teacherRoutes,
    student: studentRoutes,
  };

  return routesByRole[role] || [];
};
const Sidebar = ({
  sidebarExpanded,
  setSidebarExpanded,
  open = false,
  onClose,
  navbarRef,
}: SidebarProps) => {
  const location = useLocation();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { user } = useUnifiedAuth();

  const sidebarItems = user ? getRoutesByRole(user.role) : [];

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

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
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target;
      const clickedInsideSidebar =
        sidebarRef.current && sidebarRef.current.contains(target as Node);
      const clickedInsideNavbar =
        navbarRef && typeof navbarRef === "object" && navbarRef.current && navbarRef.current.contains(target as Node);
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

  const toggleDropdown = (dropdownId: string | null) => {
    console.log("Toggling:", dropdownId);
    if (sidebarExpanded) {
      setOpenDropdown(openDropdown === dropdownId ? null : dropdownId);
    } else {
      setSidebarExpanded(true);
    }
  };

  return (
    <>
      <motion.aside
        initial={false}
        animate={{
          width: sidebarExpanded ? "250px" : "64px",
          left: window.innerWidth < 768 ? (open ? "0" : "-260px") : "0",
        }}
        ref={sidebarRef}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={`fixed h-[calc(100vh-3.5rem)] flex bg-sidebar  flex-col z-50 border-r border-border shadow-xl`}
      >
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="scrollbar min-h-full [&::-webkit-scrollbar]:hidden scrollbar-hide">
              <div className="flex-1 overflow-x-hidden h-[calc(100vh-4rem)] py-4 scrollbar-thin [&::-webkit-scrollbar]:hidden scrollbar-hide">
                <ul className="space-y-1 px-2">
                  {sidebarItems.map((item) => (
                    <li key={item.id}>
                      {!item.dropdown ? (
                        <NavLink
                          to={item.link as string}
                          className={({ isActive }: { isActive: boolean }) =>
                            `flex items-center w-full px-3 py-2 rounded-md transition-all duration-200 ${isActive
                              ? "bg-accent text-accent-foreground"
                              : "hover:inset-1 hover:inset-ring"
                            } ${sidebarExpanded ? "gap-3" : "justify-center"}`
                          }
                          onClick={() => {
                            setOpenDropdown(null);
                            if (window.innerWidth < 768 && onClose) {
                              onClose();
                            }
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
                            className={`flex items-center w-full p-3 rounded-md transition-all duration-200 ${sidebarExpanded
                              ? "justify-between gap-3"
                              : "justify-center"
                              }`}
                            onClick={() => toggleDropdown(item.id)}
                          >
                            <div
                              className={`flex items-center ${sidebarExpanded ? "gap-3" : ""
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
                                  {item.items?.map((subItem) => (
                                    <li key={subItem.id}>
                                      <NavLink
                                        to={subItem.link}
                                        className={({ isActive }: { isActive: boolean }) =>
                                          `flex items-center w-full px-3 py-2 rounded-md transition-all duration-200 ${isActive
                                            ? "bg-accent text-accent-foreground"
                                            : "hover:inset-1 hover:inset-ring"
                                          }`
                                        }
                                        onClick={() => {
                                          console.log(subItem);
                                          if (
                                            window.innerWidth < 768 &&
                                            onClose
                                          ) {
                                            onClose();
                                          }
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
