/* eslint-disable no-unused-vars */

import { useEffect, useState, useRef } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import {
  FaHome,
  FaUser,
  FaClipboardList,

} from "react-icons/fa";
import {
  FaGear,
  FaRegImage,
} from "react-icons/fa6";
import LogoutConfirmation from "./LogOutConfirmation";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, NavLink } from "react-router-dom";
import AppContext from "../context/appContext";
import { useContext } from "react";
import { useAuth } from "../context/appContext";

const Sidebar = () => {
  const { sidebarExpanded, setSidebarExpanded } = useContext(AppContext);
  const { logout } = useAuth();
  const [openDropdown, setOpenDropdown] = useState(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  useEffect(() => {
    const updateSize = () => setSidebarExpanded(window.innerWidth > 768);
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const location = useLocation();

  const sidebarItems = [
    // { label: "Home", icon: FaHome, dropdown: false, link: "/", id: "home" },
    {
      label: "Profile",
      icon: FaUser,
      dropdown: false,
      link: "/profile",
      id: "profile",
    },
    {
      label: "Reports",
      icon: FaClipboardList,
      dropdown: false,
      link: "/reports",
      id: "reports",
    },

    {
      label: "Settings",
      icon: FaGear,
      dropdown: false,
      link: "/settings",
      id: "settings",
    },
    {
      label: "Gallery",
      icon: FaRegImage,
      dropdown: true,
      id: "gallery",
      items: [
        {
          label: "Approved Images",
          link: "/gallery/approved",
          id: "upload-image",
        },
        {
          label: "Pending Images",
          link: "/gallery/pending",
          id: "approve-image",
        },
        {
          label: "Rejected Images",
          link: "/gallery/rejected",
          id: "rejected-image",
        },
      ],
    },
  ];

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
  const sidebarRef = useRef();
  const closeMobileSidebar = () => {
    if (mobileSidebarOpen) {
      setMobileSidebarOpen(false);
    }
  };
  const closeSidebar = () => {
    if (mobileSidebarOpen) {
      setMobileSidebarOpen(false);
    }

    if (sidebarExpanded && window.innerWidth <= 768) {
      setSidebarExpanded(false);
    }
  };
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        closeSidebar();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [mobileSidebarOpen, sidebarExpanded]);

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
          left: mobileSidebarOpen ? "0" : "0",
        }}
        ref={sidebarRef}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={`fixed h-[calc(100vh-3.5rem)] flex bg-sidebar  flex-col z-50 border-r border-border shadow-xl`}
      >
        {/* Toggle Button */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {" "}
            {/* Add height constraints here */}
            <div className="scrollbar-thin min-h-full">
              <button
                className="absolute md:hidden -right-4 top-6 p-1 rounded-full shadow-md z-50"
                onClick={() => {
                  setSidebarExpanded(!sidebarExpanded);
                }}
              >
                {sidebarExpanded ? (
                  <ChevronLeft className="text-sm" />
                ) : (
                  <ChevronRight className="text-sm" />
                )}
              </button>

              <div className="flex-1 overflow-x-hidden h-[calc(100vh-6rem)] py-4 scrollbar-thin">
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
                            closeMobileSidebar();
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
                                          closeMobileSidebar();
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
          {/* Logout Button */}
          <LogoutConfirmation
            onClick={logout}
            sidebarExpanded={sidebarExpanded}
          />
        </div>
      </motion.aside>
    </>
  );
};

export default Sidebar;
