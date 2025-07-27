"use client";
import { useEffect, useRef, useState } from "react";
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
  open?: boolean;
  onClose?: () => void;
  navbarRef?: React.RefObject<HTMLDivElement | null>;
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

const SIDEBAR_WIDTH = 320;

const Sidebar = ({ children, open = false, onClose, navbarRef }: SidebarProps) => {
  const { sidebarExpanded, setSidebarExpanded } = useApp();
  const { logout } = useAuth(); // assuming user object has displayName
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const updateSize = () => setSidebarExpanded(window.innerWidth > 768);
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

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
  }, [pathname]);

  const sidebarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const clickedInsideSidebar = sidebarRef.current && sidebarRef.current.contains(target);
      const clickedInsideNavbar = navbarRef?.current && navbarRef.current.contains(target);
      if (
        !clickedInsideSidebar &&
        !clickedInsideNavbar
      ) {
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

  // Sidebar style for mobile and desktop
  return (
    <div className="flex">
      <aside
        ref={sidebarRef}
        className={`
          fixed z-50 left-0 flex flex-col
          shadow-xl
          md:bg-[var(--color-sidebar)] md:shadow-none
          transition-transform duration-300
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:static md:translate-x-0
          bg-[var(--color-sidebar)]
          overflow-y-auto
        `}
        style={{
          top: "3.5rem",
          width: typeof window !== "undefined" && window.innerWidth < 768 ? SIDEBAR_WIDTH : (sidebarExpanded ? "250px" : "64px"),
          maxWidth: "90vw",
          height: "calc(100vh - 3.5rem)",
          borderRight: "1px solid var(--color-sidebar-border)",
          background: "var(--color-sidebar)",
        }}
      >
        {/* Sidebar fills height and uses flex-col */}
        <div className="flex flex-col h-full min-h-0">
          {/* Scrollable menu area */}
          <div className=" min-h-0">
            <ul className="space-y-1 px-2 py-2">
              {sidebarItems.map((item) => (
                <li key={item.id}>
                  {!item.dropdown ? (
                    <Link
                      href={item.link ?? "/"}
                      className={`flex items-center w-full px-4 py-3 rounded-lg transition-all duration-200 ${pathname === item.link
                        ? "bg-[var(--color-sidebar-accent)] text-[var(--color-sidebar-accent-foreground)]"
                        : "hover:bg-[var(--color-sidebar-accent)] hover:text-[var(--color-sidebar-accent-foreground)] text-[var(--color-sidebar-foreground)]"
                        } gap-4`}
                      style={{
                        fontWeight: pathname === item.link ? 600 : 400,
                      }}
                      onClick={() => {
                        setOpenDropdown(null);
                        if (window.innerWidth < 768 && onClose) onClose();
                      }}
                    >
                      <item.icon className="flex-shrink-0 h-5 w-5" />
                      <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                        {item.label}
                      </span>
                    </Link>
                  ) : (
                    <div />
                  )}
                </li>
              ))}
            </ul>
          </div>
          
        </div>
      </aside>
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
};

export default Sidebar;