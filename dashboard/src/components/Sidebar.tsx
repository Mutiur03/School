import { useEffect, useState, useRef, useMemo } from 'react';
import type { ForwardedRef } from 'react';
import { FaHome, FaUser, FaClipboardList, FaUsers, FaCogs } from 'react-icons/fa';
import { FaGear, FaRegImage, FaBullhorn } from 'react-icons/fa6';

import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, NavLink, useNavigate } from 'react-router-dom';
import { Megaphone, Calendar, CalendarClock, TreePalm, ChevronDown } from 'lucide-react';
import { useAuth } from '@/context/useAuth';
import useNavigationStore from '@/store/navigation.Store';
import ConfirmationPopup from '@/components/ConfirmationPopup';
import { prefetchRoute } from '@/lib/routePrefetch';

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
  roles?: ('admin' | 'teacher' | 'student' | 'super_admin')[];
}
const getRoutesByRole = (role: 'admin' | 'teacher' | 'student' | 'super_admin') => {
  const adminRoutes: SidebarItem[] = [
    {
      label: 'Dashboard',
      icon: FaHome,
      dropdown: false,
      link: '/admin/dashboard',
      id: 'dashboard',
      roles: ['admin'],
    },
    {
      label: 'Student',
      icon: FaUsers,
      dropdown: true,
      id: 'student',
      link: '/admin/students',
      roles: ['admin'],
      items: [
        {
          label: 'Student List',
          link: '/admin/students/student-list',
          id: 'student-list',
        },
        {
          label: 'Alumni List',
          link: '/admin/students/alumni-list',
          id: 'alumni-list',
        },
      ],
    },
    {
      label: 'Teacher',
      icon: FaUser,
      dropdown: true,
      id: 'administration',
      roles: ['admin'],
      items: [
        {
          label: 'Teacher List',
          link: '/admin/administration/teacher-list',
          id: 'teachers',
        },
        {
          label: 'Staff List',
          link: '/admin/administration/staff-list',
          id: 'staff-list',
        },

        {
          label: 'Message From Head',
          link: '/admin/administration/head',
          id: 'head-message',
        },
      ],
    },
    {
      label: 'Results',
      icon: FaClipboardList,
      dropdown: true,
      id: 'reports',
      roles: ['admin'],
      items: [
        {
          label: 'Subjects',
          link: '/admin/result/add-subject',
          id: 'add-subject',
        },
        {
          label: 'Assigned Teachers',
          link: '/admin/result/assigned-teachers',
          id: 'assignments',
        },
        {
          label: 'Add Marks',
          link: '/admin/result/add-marks',
          id: 'add-marks',
        },
        {
          label: 'View Result',
          link: '/admin/result/view-marks',
          id: 'view-marks',
        },
        {
          label: 'Generate Result',
          link: '/admin/result/generate-result',
          id: 'generate-result',
        },
        {
          label: 'Customize Result',
          link: '/admin/result/customize-result',
          id: 'customize-result',
        },
      ],
    },
    {
      label: 'Registration',
      icon: FaCogs,
      dropdown: true,
      id: 'registration',
      roles: ['admin'],
      items: [
        {
          label: 'Class Six Registration',
          link: '/admin/registration/class-6',
          id: 'class-6-registration',
        },
        {
          label: 'Class Eight Registration',
          link: '/admin/registration/class-8',
          id: 'class-8-registration',
        },
        {
          label: 'Class Nine Registration',
          link: '/admin/registration/class-9',
          id: 'class-9-registration',
        },
      ],
    },
    {
      label: 'Admission',
      icon: Megaphone,
      dropdown: true,
      id: 'admission',
      roles: ['admin'],
      items: [
        {
          label: 'Form',
          link: '/admin/admission/form',
          id: 'admission-form',
        },
        {
          label: 'Settings',
          link: '/admin/admission/settings',
          id: 'admission-settings',
        },
        {
          label: 'Result',
          link: '/admin/admission/result',
          id: 'admission-result',
        },
      ],
    },
    {
      label: 'Settings',
      icon: FaGear,
      dropdown: true,
      id: 'settings',
      roles: ['admin'],
      items: [
        {
          label: 'Exam',
          link: '/admin/settings/add-exam',
          id: 'add-exam',
        },
        {
          label: 'Syllabus',
          link: '/admin/syllabus',
          id: 'syllabus',
        },
        {
          label: 'Class Routine',
          link: '/admin/classRoutine',
          id: 'class-routine',
        },
        {
          label: 'Citizen Charter',
          link: '/admin/citizencharter',
          id: 'citizen-charter',
        },
      ],
    },
    {
      label: 'Attendance',
      icon: Calendar,
      dropdown: false,
      link: '/admin/attendance',
      id: 'attendance',
      roles: ['admin'],
    },
    {
      label: 'Running Away',
      icon: CalendarClock,
      dropdown: false,
      link: '/admin/attendance-double',
      id: 'stay-check',
      roles: ['admin'],
    },
    {
      label: 'SMS Management',
      icon: Megaphone,
      dropdown: false,
      link: '/admin/sms-management',
      id: 'sms-management',
      roles: ['admin'],
    },
    {
      label: 'Notice',
      icon: FaBullhorn,
      dropdown: false,
      link: '/admin/notice',
      id: 'notice',
      roles: ['admin'],
    },
    {
      label: 'Holiday',
      icon: TreePalm,
      dropdown: false,
      link: '/admin/holiday',
      id: 'holiday',
      roles: ['admin'],
    },
    {
      label: 'Events',
      icon: CalendarClock,
      dropdown: false,
      link: '/admin/events',
      id: 'events',
      roles: ['admin'],
    },
    {
      label: 'Gallery',
      icon: FaRegImage,
      dropdown: true,
      id: 'gallery',
      roles: ['admin'],
      items: [
        {
          label: 'Upload Image',
          link: '/admin/gallery/upload',
          id: 'upload-image',
        },
        {
          label: 'Aprrove Image',
          link: '/admin/gallery/pending',
          id: 'approve-image',
        },
        {
          label: 'Rejected Image',
          link: '/admin/gallery/rejected',
          id: 'rejected-image',
        },
      ],
    },
  ];

  const teacherRoutes: SidebarItem[] = [
    {
      label: 'Dashboard',
      icon: FaHome,
      dropdown: false,
      link: '/teacher/dashboard',
      id: 'dashboard',
      roles: ['teacher'],
    },
    {
      label: "Students' Info",
      icon: FaUsers,
      dropdown: false,
      link: '/teacher/students',
      id: 'students',
      roles: ['teacher'],
    },
    {
      label: 'Attendance',
      icon: Calendar,
      dropdown: false,
      link: '/teacher/attendance',
      id: 'attendance',
      roles: ['teacher'],
    },
    {
      label: 'Running Away',
      icon: CalendarClock,
      dropdown: false,
      link: '/teacher/attendance-double',
      id: 'stay-check',
      roles: ['teacher'],
    },
    {
      label: 'Mark Management',
      icon: FaClipboardList,
      dropdown: true,
      id: 'mark-management',
      roles: ['teacher'],
      items: [
        {
          label: 'Add Marks',
          link: '/teacher/mark-management',
          id: 'add-marks',
        },
        {
          label: 'View Result',
          link: '/teacher/result/view-marks',
          id: 'view-marks',
        },
      ],
    },
    {
      label: 'Settings',
      icon: FaCogs,
      dropdown: false,
      link: '/teacher/settings',
      id: 'settings',
      roles: ['teacher'],
    },
  ];

  const studentRoutes: SidebarItem[] = [
    {
      label: 'Dashboard',
      icon: FaHome,
      dropdown: false,
      link: '/student/dashboard',
      id: 'dashboard',
      roles: ['student'],
    },
    {
      label: 'Profile',
      icon: FaUser,
      dropdown: false,
      link: '/student/profile',
      id: 'profile',
      roles: ['student'],
    },
    {
      label: 'Result',
      icon: FaClipboardList,
      dropdown: false,
      link: '/student/result',
      id: 'result',
      roles: ['student'],
    },
  ];

  const routesByRole = {
    admin: adminRoutes,
    teacher: teacherRoutes,
    student: studentRoutes,
    super_admin: [
      {
        label: 'Dashboard',
        icon: FaHome,
        dropdown: false,
        link: '/super_admin/dashboard',
        id: 'dashboard',
        roles: ['super_admin'],
      },
      {
        label: 'School Management',
        icon: FaGear,
        dropdown: false,
        link: '/super_admin/settings/school',
        id: 'school-settings',
        roles: ['super_admin'],
      },
    ] as SidebarItem[],
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
  const navigate = useNavigate();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { isDirty, resetDirty } = useNavigationStore();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const pendingHref = useRef<string | null>(null);

  const sidebarItems = useMemo(() => (user ? getRoutesByRole(user.role) : []), [user]);

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const isPathActive = (path?: string) => {
    if (!path) return false;
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  useEffect(() => {
    const updateSize = () => {
      if (window.innerWidth >= 768) {
        setSidebarExpanded(true);
      } else {
        setSidebarExpanded(open);
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
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
  }, [location.pathname, sidebarItems]);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target;
      const clickedInsideSidebar =
        sidebarRef.current && sidebarRef.current.contains(target as Node);
      const clickedInsideNavbar =
        navbarRef &&
        typeof navbarRef === 'object' &&
        navbarRef.current &&
        navbarRef.current.contains(target as Node);
      if (!clickedInsideSidebar && !clickedInsideNavbar) {
        if (window.innerWidth < 768 && open && onClose) {
          onClose();
        }
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onClose, navbarRef]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!open || window.innerWidth >= 768) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const toggleDropdown = (dropdownId: string | null) => {
    if (sidebarExpanded) {
      setOpenDropdown(openDropdown === dropdownId ? null : dropdownId);
    } else {
      setSidebarExpanded(true);
    }
  };

  const requestNavigate = (e: React.MouseEvent, href: string) => {
    if (!isDirty) return true;
    e.preventDefault();
    pendingHref.current = href;
    setLeaveOpen(true);
    return false;
  };

  const confirmLeave = () => {
    const href = pendingHref.current;
    pendingHref.current = null;
    setLeaveOpen(false);
    resetDirty();
    if (href) {
      navigate(href);
      if (window.innerWidth < 768 && onClose) onClose();
    }
  };

  return (
    <>
      <ConfirmationPopup
        open={leaveOpen}
        onOpenChange={(open) => {
          setLeaveOpen(open);
          if (!open) pendingHref.current = null;
        }}
        onConfirm={confirmLeave}
        title="Leave without saving?"
        msg="You have unsaved attendance changes. Leaving this page will discard them."
        confirmLabel="Discard & Leave"
        cancelLabel="Stay"
        variant="destructive"
      />
      {open ? (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onClose}
        />
      ) : null}
      <motion.aside
        initial={false}
        animate={{
          width: sidebarExpanded ? '250px' : '64px',
          left:
            typeof window !== 'undefined' && window.innerWidth < 768
              ? open
                ? '0'
                : '-260px'
              : '0',
        }}
        ref={sidebarRef}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="bg-sidebar border-border fixed top-14 right-auto bottom-0 z-50 flex w-[250px] flex-col overscroll-contain border-r pb-[env(safe-area-inset-bottom,0px)] shadow-sm backdrop-blur-sm md:w-auto"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <nav className="min-h-0 flex-1 [scrollbar-width:none] overflow-x-hidden overflow-y-auto overscroll-contain py-4 [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
            <ul className="space-y-1 px-2">
              {sidebarItems.map((item) => (
                <li key={item.id}>
                  {!item.dropdown ? (
                    <NavLink
                      to={item.link as string}
                      className={() =>
                        `text-md flex w-full items-center rounded-sm px-3 py-2 font-medium transition-[color,background-color,box-shadow] duration-200 ${
                          isPathActive(item.link)
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        } ${sidebarExpanded ? 'gap-3' : 'justify-center'}`
                      }
                      onMouseEnter={() => prefetchRoute(item.link)}
                      onFocus={() => prefetchRoute(item.link)}
                      onClick={(e) => {
                        if (!requestNavigate(e, item.link as string)) return;
                        setOpenDropdown(null);
                        if (window.innerWidth < 768 && onClose) {
                          onClose();
                        }
                      }}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {sidebarExpanded && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="overflow-hidden text-ellipsis whitespace-nowrap"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </NavLink>
                  ) : (
                    <div>
                      <button
                        className={`text-md flex w-full items-center rounded-sm px-3 py-2 font-medium transition-[color,background-color,box-shadow] duration-200 ${
                          sidebarExpanded ? 'justify-between gap-3' : 'justify-center'
                        } ${
                          openDropdown === item.id
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        }`}
                        type="button"
                        onClick={() => toggleDropdown(item.id)}
                        onMouseEnter={() => {
                          item.items?.forEach((sub) => prefetchRoute(sub.link));
                        }}
                      >
                        <div className={`flex items-center ${sidebarExpanded ? 'gap-3' : ''}`}>
                          <item.icon className="h-4 w-4 shrink-0" />
                          {sidebarExpanded && (
                            <motion.span
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="overflow-hidden text-left text-ellipsis whitespace-nowrap"
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
                            <ChevronDown className="text-muted-foreground h-4 w-4" />
                          </motion.div>
                        )}
                      </button>

                      {sidebarExpanded && (
                        <AnimatePresence>
                          {openDropdown === item.id && (
                            <motion.ul
                              initial={{ height: 0, opacity: 0 }}
                              animate={{
                                height: 'auto',
                                opacity: 1,
                                transition: { duration: 0.2 },
                              }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-border ml-4 space-y-1 overflow-visible border-l pl-7"
                            >
                              {item.items?.map((subItem) => (
                                <li key={subItem.id}>
                                  <NavLink
                                    to={subItem.link}
                                    className={({ isActive }: { isActive: boolean }) =>
                                      `text-md flex w-full items-center rounded-sm px-3 py-1.5 transition-[color,background-color,box-shadow] duration-200 ${
                                        isActive
                                          ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                                          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                                      }`
                                    }
                                    onMouseEnter={() => prefetchRoute(subItem.link)}
                                    onFocus={() => prefetchRoute(subItem.link)}
                                    onClick={(e) => {
                                      if (!requestNavigate(e, subItem.link)) return;
                                      if (window.innerWidth < 768 && onClose) {
                                        onClose();
                                      }
                                    }}
                                  >
                                    <span className="overflow-hidden text-ellipsis whitespace-nowrap">
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
          </nav>
        </div>
      </motion.aside>
    </>
  );
};

export default Sidebar;
