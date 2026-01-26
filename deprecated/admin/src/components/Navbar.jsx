import React from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/authContext";
import ThemeChange from "./ThemeChange";
import LogoutConfirmation from "@/components/LogOutConfirmation";
import { Menu } from "lucide-react";
const Navbar = React.forwardRef(function Navbar({ onBurgerClick }, ref) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
      console.log("Logged out");
    } catch (error) {
      console.error("Logout failed:", error);
      toast.error("Failed to logout. Please try again.");
    }
  };
  return (
    <nav
      ref={ref}
      className="navbar h-[3.5rem] flex z-40 justify-between sticky top-0 w-full shadow-md bg-sidebar px-5 items-center backdrop-blur-xl border-b border-border"
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
      <Link to="/admin" className="text-xl text-nowrap flex items-center">
        Admin
      </Link>
      <div className="flex items-center justify-between">
        <ThemeChange vars={""} />
        <div className="scale-80 bg-popover rounded-full p-2 ">
          <LogoutConfirmation onClick={handleLogout} />
        </div>
      </div>
    </nav>
  );
});
export default Navbar;
