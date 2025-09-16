import { useState, useEffect, useRef } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useLocation } from "react-router-dom";
import axios from "axios";

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
  { name: "Teacher", path: "/administration/teacher" },
  {
    name: "Gallery",
    path: "/gallery",
    dropdown: [
      { name: "Events", path: "/gallery/events" },
      { name: "Campus", path: "/gallery/campus" },
    ],
  },
  {
    name: "Admission",
    path: "/admission",
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
  const [citizenCharterUrl, setCitizenCharterUrl] = useState<string | null>(null);
  const location = useLocation();
  const pathname = location.pathname;
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Fetch Citizen Charter PDF URL
  useEffect(() => {
    const fetchCitizenCharterUrl = async () => {
      try {
        const response = await axios.get("/api/file-upload/citizen-charter");
        setCitizenCharterUrl(response.data.file);
      } catch {
        console.log("No Citizen Charter PDF found");
      }
    };

    fetchCitizenCharterUrl();
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
    setOpenDropdown(null);
  }, [pathname]);

  // Handle outside clicks for desktop dropdown
  useEffect(() => {
    if (!openDropdown) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as Element;
      const dropdownElement = dropdownRefs.current[openDropdown];
      const buttonElement = document.querySelector(
        `[data-dropdown="${openDropdown}"]`
      );

      if (
        dropdownElement &&
        !dropdownElement.contains(target) &&
        buttonElement &&
        !buttonElement.contains(target)
      ) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openDropdown]);

  // Handle outside clicks for mobile menu
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const menuButton = document.querySelector('[aria-label*="menu"]');

      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(target) &&
        menuButton &&
        !menuButton.contains(target)
      ) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenDropdown(null);
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

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
    if (!path || path === "#") return false;
    return pathname === path || pathname.startsWith(path + "/");
  };

  const handleMenuToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMenuOpen(!isMenuOpen);
    setOpenDropdown(null);
  };

  return (
    <header className="bg-white shadow-md sticky top-0 z-40">
      {/* Top banner */}
      <div className="bg-gradient-to-r from-primary to-primary/90 text-white py-3 md:py-4">
        <div className="container-custom flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4 mb-2 md:mb-0">
            <div className="relative w-12 h-12 md:w-16 md:h-16 min-w-[48px] min-h-[48px] bg-white rounded-full overflow-hidden p-1 flex items-center justify-center shadow-lg">
              <img
                src="/icon.png"
                alt="School Logo"
                className="object-contain w-full h-full"
              />
            </div>
            <div>
              <h1 className="text-base md:text-2xl font-bold leading-tight">
                Panchbibi Lal Bihari Pilot Government High School
              </h1>
              <p className="text-xs md:text-sm opacity-90">
                Excellence in Education Since 1940
              </p>
            </div>
          </div>
          <div className="flex gap-3 md:gap-4 text-xs md:text-sm">
            <a
              href="https://student.lbphs.gov.bd"
              className="hover:underline transition-all duration-200 hover:text-yellow-200"
              target="_blank"
              rel="noopener noreferrer"
            >
              Student's Portal
            </a>
          </div>
        </div>
      </div>

      {/* Main navigation */}
      <nav className="container-custom py-2 md:py-3 relative">
        <div className="flex items-center justify-between">
          {/* Mobile menu button */}
          <button
            className="md:hidden text-primary hover:text-primary/80 transition-colors duration-200 p-2 rounded-md hover:bg-gray-100 relative"
            onClick={handleMenuToggle}
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
            type="button"
          >
            <div className="relative w-6 h-6">
              <Menu
                size={24}
                className={`absolute inset-0 transition-all duration-300 ${isMenuOpen ? "opacity-0 rotate-180 scale-90" : "opacity-100 rotate-0 scale-100"
                  }`}
              />
              <X
                size={24}
                className={`absolute inset-0 transition-all duration-300 ${isMenuOpen ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-180 scale-90"
                  }`}
              />
            </div>
            {/* Connection indicator */}
            {isMenuOpen && (
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-b-[8px] border-l-transparent border-r-transparent border-b-white z-50"></div>
            )}
          </button>

          {/* Desktop navigation */}
          <div className="hidden md:flex items-center space-x-1 w-full">
            {navItems.map((item) => (
              <div
                key={item.name}
                className="relative"
                onMouseEnter={() => item.dropdown && handleMouseEnter(item.name)}
                onMouseLeave={() => item.dropdown && handleMouseLeave()}
              >
                {item.dropdown ? (
                  <div className="relative">
                    <button
                      data-dropdown={item.name}
                      className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1 transition-all duration-200 ${isActive(item.path) || openDropdown === item.name
                        ? "text-white bg-primary shadow-md"
                        : "text-gray-700 hover:bg-gray-100 hover:text-primary"
                        }`}
                      aria-expanded={openDropdown === item.name}
                      aria-haspopup="true"
                    >
                      {item.name}
                      <ChevronDown
                        size={16}
                        className={`transition-transform duration-200 ${openDropdown === item.name ? "rotate-180" : ""
                          }`}
                      />
                    </button>

                    {/* Desktop dropdown */}
                    {openDropdown === item.name && (
                      <div
                        ref={(el) => {
                          dropdownRefs.current[item.name] = el;
                        }}
                        className="absolute top-full left-0 w-48 bg-white shadow-lg rounded-lg overflow-hidden z-50 border border-gray-100 animate-in slide-in-from-top-2 duration-200"
                      >
                        {item.dropdown.map((subItem) => (
                          <Link
                            key={subItem.name}
                            to={subItem.path}
                            className={`block px-4 py-3 text-sm transition-colors duration-200 ${isActive(subItem.path)
                              ? "bg-primary/10 text-primary border-r-2 border-primary"
                              : "text-gray-700 hover:bg-gray-50 hover:text-primary"
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
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive(item.path)
                      ? "text-white bg-primary shadow-md"
                      : "text-gray-700 hover:bg-gray-100 hover:text-primary"
                      }`}
                  >
                    {item.name}
                  </Link>
                )}
              </div>
            ))}

            {/* Citizen Charter Link */}
            <a
              href={citizenCharterUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 text-gray-700 hover:bg-gray-100 hover:text-primary"
            >
              Citizen Charter
            </a>
          </div>
        </div>

        {/* Mobile menu - Connected dropdown style */}
        {isMenuOpen && (
          <div
            ref={mobileMenuRef}
            className="md:hidden absolute top-full left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 animate-in slide-in-from-top-2 duration-300 max-h-[calc(100vh-200px)] overflow-y-auto"
          >
            <div className="container-custom py-4">
              <div className="space-y-1">
                {navItems.map((item) => (
                  <div key={item.name} className="relative">
                    {item.dropdown ? (
                      <div>
                        <button
                          onClick={() => toggleDropdown(item.name)}
                          className={`w-full px-4 py-3 rounded-lg text-sm font-medium flex items-center justify-between transition-all duration-200 ${isActive(item.path) || openDropdown === item.name
                            ? "text-primary bg-primary/10"
                            : "text-gray-700 hover:bg-gray-100"
                            }`}
                          aria-expanded={openDropdown === item.name}
                          type="button"
                        >
                          <span>{item.name}</span>
                          <ChevronDown
                            size={16}
                            className={`transition-transform duration-200 ${openDropdown === item.name ? "rotate-180" : ""
                              }`}
                          />
                        </button>

                        {/* Mobile dropdown */}
                        <div
                          className={`overflow-hidden transition-all duration-300 ${openDropdown === item.name
                            ? "max-h-96 opacity-100 mt-1"
                            : "max-h-0 opacity-0"
                            }`}
                        >
                          <div className="ml-4 space-y-1 border-l-2 border-primary/20 pl-4">
                            {item.dropdown.map((subItem) => (
                              <Link
                                key={subItem.name}
                                to={subItem.path}
                                onClick={() => {
                                  setIsMenuOpen(false);
                                  setOpenDropdown(null);
                                }}
                                className={`block px-3 py-2 rounded-md text-sm transition-colors duration-200 ${isActive(subItem.path)
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "text-gray-600 hover:bg-gray-50 hover:text-primary"
                                  }`}
                              >
                                {subItem.name}
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <Link
                        to={item.path || "#"}
                        onClick={() => setIsMenuOpen(false)}
                        className={`block px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${isActive(item.path)
                          ? "text-primary bg-primary/10"
                          : "text-gray-700 hover:bg-gray-100"
                          }`}
                      >
                        {item.name}
                      </Link>
                    )}
                  </div>
                ))}

                {/* Mobile Citizen Charter Link */}
                {citizenCharterUrl && (
                  <a
                    href={citizenCharterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsMenuOpen(false)}
                    className="block px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 text-gray-700 hover:bg-gray-100"
                  >
                    Citizen Charter
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}