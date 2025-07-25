import ThemeChange from "./ThemeChange";
import { useAuth } from "../context/appContext";
import { Menu } from "lucide-react";
import React from "react";

const Navbar = React.forwardRef(function Navbar({ onBurgerClick }, ref) {
  const { student } = useAuth();
  const host = import.meta.env.VITE_BACKEND_URL;
  return (
    <>
      <nav
        ref={ref}
        className="navbar h-[3.5rem] flex z-30 justify-between sticky top-0 w-full bg-sidebar border-b shadow-md px-5 items-center backdrop-blur-xl"
      >
        {/* Burger menu only on mobile */}
        <button
          className="md:hidden mr-2 p-2 rounded focus:outline-none focus:ring-2 focus:ring-gray-400"
          onClick={() => {
            if (onBurgerClick) {
              onBurgerClick();
              console.log("Burger clicked");
            }
          }}
          aria-label="Open sidebar"
          type="button"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h2>Student Dashboard</h2>
        <div className="mr-8">
          <div className="flex items-center gap-4 justify-between">
            <img
              src={
                student.image
                  ? `${host}/${student.image}`
                  : "/placeholder-profile.jpg"
              }
              alt="Profile"
              className="w-10 h-10 rounded-full border-4  border-gray-300 shadow-sm object-cover"
            />
            <span className="hidden md:block max-w-[120px] truncate">
              {student.name}
            </span>
            <ThemeChange />
          </div>
        </div>
      </nav>
    </>
  );
});

export default Navbar;
