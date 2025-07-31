import { useState, useEffect } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useLocation } from "react-router-dom";
const navItems = [
  { name: "Home", path: "/" },
  {
    name: "About",
    path: "/about",
    dropdown: [
      { name: "History", path: "/about/history" },
      { name: "LBP at a glance", path: "/about/glance" },
    ],
  },
  // {
  //   name: "Administration",
  //   path: "/administration",
  //   dropdown: [
  //     { name: "Teacher", path: "/administration/teacher" },
  //     { name: "Staff", path: "/administration/staff" },
  //   ],
  // },
  { name: "Teacher", path: "/administration/teacher" },

  {
    name: "Gallery", path: "/gallery",
    dropdown: [
      { name: "Events", path: "/gallery/events" },
      { name: "Campus", path: "/gallery/campus" },
    ],
  },
  {
    name: "Admission",
  },
  { name: "Notice", path: "/notice" },
  { name: "Events", path: "/events" },
  { name: "Syllabus", path: "/syllabus" },
  {
    name: "Routine",
    path: "/routine",
    dropdown: [
      { name: "Class Routine", path: "/routine/class" },
      { name: "Exam Routine", path: "/routine/exam" },
    ],
  },
];
export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const location = useLocation();
  const pathname = location.pathname
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!openDropdown) return;
    const handleClick = (e: MouseEvent) => {
      const dropdowns = document.querySelectorAll(
        ".desktop-dropdown, .desktop-dropdown-btn"
      );
      let clickedInside = false;
      dropdowns.forEach((el) => {
        if (el.contains(e.target as Node)) clickedInside = true;
      });
      if (!clickedInside) setOpenDropdown(null);
    };
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [openDropdown]);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const menu = document.querySelector(".mobile-menu");
      if (menu && !menu.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  const toggleDropdown = (name: string) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  const handleMouseEnter = (name: string) => {
    setOpenDropdown(name);
  };

  const handleMouseLeave = () => {
    setOpenDropdown(null);
  };

  const isActive = (path: string) => {
    return pathname === path || pathname.startsWith(path + "/");
  };
  return (
    <header className="bg-white shadow-md sticky top-0 z-50">
      <div className="bg-primary text-white py-4">
        <div className="container-custom flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-4 mb-3 md:mb-0">
            <div className="relative h-12 w-12 md:h-16 md:w-16 bg-white rounded-full overflow-hidden  p-1">
              <img
                src="/icon.png"
                alt="School Logo"
                width={60}
                height={60}
                className="object-contain w-full h-full"
              />
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-bold leading-tight">
                Panchbibi Lal Bihari Pilot Government High School

              </h1>
              <p className="text-xs md:text-base">
                Excellence in Education Since 1940
              </p>
            </div>
          </div>
          <div className="flex gap-2 md:gap-4 text-xs md:text-sm">
            {/* <Link to="/contact" className="hover:underline">
              Contact Us
            </Link> */}
            <a href="https://student.lbphs.gov.bd" className="hover:underline">
              Student's Portal
            </a>
          </div>
        </div>
      </div>
      {/* Main navigation */}
      <nav className="container-custom py-2 md:py-3">
        <div className="flex items-center justify-between">
          {/* Mobile menu button */}
          <button
            className="md:hidden text-primary"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X size={28} className="sm:size-6" /> : <Menu size={28} className="sm:size-6" />}
          </button>
          {/* Desktop navigation */}
          <div className="hidden md:flex items-center space-x-1 w-full">
            {navItems.map((item) => (
              <div
                key={item.name}
                className="relative"
                onMouseEnter={() => item.dropdown && handleMouseEnter(item.name)}
                onMouseLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    handleMouseLeave();
                  }
                }}
              >
                {item.dropdown ? (
                  <div className="relative">
                    <button
                      className={`desktop-dropdown-btn px-2 md:px-3 py-2 rounded-md text-xs md:text-sm font-medium flex items-center gap-1 ${isActive(item.path)
                        ? "text-white bg-primary"
                        : "text-gray-700 hover:bg-gray-100"
                        }`}
                    >
                      {item.name}
                      <ChevronDown size={16} className="inline md:size-4 size-3" />
                    </button>
                    {/* Desktop dropdown */}
                    {openDropdown === item.name && (
                      <div className="desktop-dropdown absolute top-full left-0 w-40 md:w-48 bg-white shadow-lg rounded-md overflow-hidden z-20">
                        {item.dropdown.map((subItem) => (
                          <Link
                            key={subItem.name}
                            to={subItem.path}
                            onClick={() => {
                              setIsMenuOpen(false);
                              setOpenDropdown(null);
                            }}
                            className={`block px-4 py-2 text-xs md:text-sm ${pathname === subItem.path
                              ? "bg-primary/10 text-primary"
                              : "text-gray-700 hover:bg-gray-100"
                              }`}
                          >
                            {subItem.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    to={item.path || "#"}
                    onClick={() => {
                      setIsMenuOpen(false);
                      setOpenDropdown(null);
                    }} className={`px-2 md:px-3 py-2 rounded-md text-xs md:text-sm font-medium flex items-center gap-1 ${isActive(item.path || "#")
                      ? "text-white bg-primary"
                      : "text-gray-700 hover:bg-gray-100"
                      }`}
                  >
                    {item.name}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
        {/* Mobile navigation */}
        {isMenuOpen && (
          <div className="mobile-menu md:hidden mt-3 bg-white rounded-md shadow-lg w-full max-w-sm mx-auto z-50">
            <div className="px-2 pt-3 pb-4 space-y-2">
              {navItems.map((item) => (
                <div key={item.name} className="relative">
                  {item.dropdown ? (
                    <div className="relative">
                      <button
                        onClick={() => toggleDropdown(item.name)}
                        className={`desktop-dropdown-btn px-3 py-2 w-full rounded-md text-xs font-medium flex items-center gap-1 ${isActive(item.path)
                          ? "text-white bg-primary"
                          : "text-gray-700 hover:bg-gray-100"
                          }`}
                      >
                        {item.name}
                        <ChevronDown size={14} className="inline" />
                      </button>
                      {/* Desktop dropdown */}
                      {openDropdown === item.name && (
                        <div className="desktop-dropdown w-full absolute top-full left-0 mt-1 bg-white shadow-lg rounded-md overflow-hidden z-20">
                          {item.dropdown.map((subItem) => (
                            <Link
                              key={subItem.name}
                              to={subItem.path}
                              onClick={() => {
                                setIsMenuOpen(false);
                                setOpenDropdown(null);
                              }}
                              className={`block px-4 py-2 text-xs font-medium ${pathname === subItem.path
                                ? "bg-primary/10 text-primary"
                                : "text-gray-700 hover:bg-gray-100"
                                }`}
                            >
                              {subItem.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Link
                      to={item.path || "#"}
                      onClick={() => {
                        setIsMenuOpen(false);
                        setOpenDropdown(null);
                      }} className={`px-3 py-2 rounded-md text-xs font-medium ${isActive(item.path || "#")
                        ? "text-white bg-primary"
                        : "text-gray-700 hover:bg-gray-100"
                        }`}
                    >
                      {item.name}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}