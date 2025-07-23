"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { FaUser, FaClipboardList } from "react-icons/fa";
import { FaGear } from "react-icons/fa6";
import type { IconType } from "react-icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/authContext";
import { useApp } from "@/context/appContext";
import { ReactNode } from "react";
import LogoutConfirmation from "./LogOutConfirmation";

interface SidebarProps {
  children: ReactNode;
}

interface SidebarItem {
  label: string;
  icon: IconType;
  dropdown: boolean;
  link?: string;
  id: string;
  items?: {
    id: string;
    label: string;
    link: string;
  }[];
}

const sidebarItems: SidebarItem[] = [
  {
    label: "Profile",
    icon: FaUser,
    dropdown: false,
    link: "/",
    id: "profile",
  },
  {
    label: "Mark Management",
    icon: FaClipboardList,
    dropdown: false,
    link: "/marks",
    id: "marks",
  },
  {
    label: "Settings",
    icon: FaGear,
    dropdown: false,
    link: "/settings",
    id: "settings",
  }
];

const Sidebar = ({ children }: SidebarProps) => {
  const { sidebarExpanded, setSidebarExpanded } = useApp();
  const { logout } = useAuth();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const pathname = usePathname();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  useEffect(() => {
    const updateSize = () => setSidebarExpanded(window.innerWidth > 768);
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Open dropdown if current path matches a subitem
  useEffect(() => {
    let foundActive = false;
    for (const item of sidebarItems) {
      if (item.link === pathname) {
        setOpenDropdown(null);
        foundActive = true;
        break;
      }
      if (item.items) {
        for (const subItem of item.items) {
          if (subItem.link === pathname) {
            setOpenDropdown(item.id);
            foundActive = true;
            break;
          }
        }
        if (foundActive) break;
      }
    }
    if (!foundActive) setOpenDropdown(null);
    // Close mobile sidebar on navigation
    closeMobileSidebar();
  }, [pathname]);
  const sidebarRef = useRef<HTMLDivElement | null>(null);
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
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(target)
      ) {
        closeSidebar();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [mobileSidebarOpen, sidebarExpanded]);
  const toggleDropdown = (dropdownId: string) => {
    setOpenDropdown(openDropdown === dropdownId ? null : dropdownId);
  };

  return (
    <div className="flex w-full">
      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className="fixed left-0 top-[3.5rem] flex flex-col z-50"
        style={{
          width: sidebarExpanded ? "250px" : "64px",
          height: "calc(100vh - 3.5rem)",
          transition: "width 0.2s",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          background: "var(--color-sidebar)",
          borderRight: "1px solid var(--color-sidebar-border)",
        }}
      >
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="min-h-full">
              {/* Toggle Button */}
              <button
                className="absolute md:hidden -right-4 top-6 p-1 rounded-full shadow-md z-50"
                style={{
                  background: "var(--color-sidebar)",
                  color: "var(--color-sidebar-foreground)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                }}
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
                        <Link
                          href={item.link ?? "/"}
                          className={`flex items-center w-full px-3 py-2 rounded-md transition-all duration-200 ${pathname === item.link
                            ? ""
                            : ""} ${sidebarExpanded ? "gap-3" : "justify-center"}`}
                          style={{
                            background: pathname === item.link ? "var(--color-sidebar-accent)" : "var(--color-sidebar)",
                            color: pathname === item.link ? "var(--color-sidebar-accent-foreground)" : "var(--color-sidebar-foreground)",
                          }}
                          onClick={() => {
                            setOpenDropdown(null);
                            closeMobileSidebar();
                          }}
                        >
                          <item.icon className="flex-shrink-0 h-4 w-4 text-lg" />
                          {sidebarExpanded && (
                            <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                              {item.label}
                            </span>
                          )}
                        </Link>
                      ) : (
                        <div>
                          <button
                            className={`flex items-center w-full p-3 rounded-md transition-all duration-200 ${sidebarExpanded ? "justify-between gap-3" : "justify-center"}`}
                            style={{
                              background: "var(--color-sidebar)",
                              color: "var(--color-sidebar-foreground)",
                            }}
                            onClick={() => {
                              if (!sidebarExpanded) setSidebarExpanded(true);
                              toggleDropdown(item.id);
                              closeMobileSidebar();
                            }}
                          >
                            <div
                              className={`flex items-center ${sidebarExpanded ? "gap-3" : ""}`}
                            >
                              <item.icon className="flex-shrink-0 h-4 w-4 text-lg" />
                              {sidebarExpanded && (
                                <span className="whitespace-nowrap overflow-hidden text-ellipsis text-left">
                                  {item.label}
                                </span>
                              )}
                            </div>
                            {sidebarExpanded && (
                              <span
                                style={{
                                  display: "inline-block",
                                  transform: openDropdown === item.id ? "rotate(180deg)" : "none",
                                  transition: "transform 0.2s",
                                }}
                              >
                                <ChevronDown className="text-xs" />
                              </span>
                            )}
                          </button>
                          {sidebarExpanded && openDropdown === item.id && (
                            <ul className="overflow-visible space-y-1 pl-9">
                              {item.items?.map((subItem) => (
                                <li key={subItem.id}>
                                  <Link
                                    href={subItem.link}
                                    className="flex items-center w-full px-3 py-2 rounded-md transition-all duration-200"
                                    style={{
                                      background: pathname === subItem.link ? "var(--color-sidebar-accent)" : "var(--color-sidebar)",
                                      color: pathname === subItem.link ? "var(--color-sidebar-accent-foreground)" : "var(--color-sidebar-foreground)",
                                    }}
                                    onClick={closeMobileSidebar}
                                  >
                                    <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                                      {subItem.label}
                                    </span>
                                  </Link>
                                </li>
                              ))}
                            </ul>
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
      </aside>
      {/* Main content */}
      <main className={`flex-1 ${sidebarExpanded ? "ml-[250px]" : "ml-[64px]"} transition-all duration-200`}>
        {children}
      </main>
    </div>
  );
};

export default Sidebar;