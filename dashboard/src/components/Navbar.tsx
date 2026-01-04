import { forwardRef } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import ThemeChange from "../components/ThemeChange";
import LogoutConfirmation from "@/components/LogOutConfirmation";
import { Menu } from "lucide-react";
import { useAuth } from "@/context/useAuth";
import { fixURL } from "@/lib/fixURL";

interface NavbarProps {
  onBurgerClick?: () => void;
}

const Navbar = forwardRef<HTMLElement, NavbarProps>(({ onBurgerClick }, ref) => {
  const { logout, user } = useAuth();
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
      {user && user.role === "admin" &&
        <Link to="/admin" className="text-xl text-nowrap flex items-center">
          Admin
        </Link>}
      {user && user.role === "teacher" &&
        <Link to="/teacher" className="text-xl text-nowrap flex items-center">
          Teacher's Dashboard
        </Link>}
      {user && user.role === "student" &&
        <Link to="/student" className="text-xl text-nowrap flex items-center">
          Student's Dashboard
        </Link>}
      <div className="flex items-center justify-between">
        {user && user.role === "teacher" && (
          user?.image ? (
            <div className="w-10 h-10 rounded-full border-4 border-gray-300 shadow-sm overflow-hidden">
              <img
                src={fixURL(user.image)}
                alt="Profile"
                width={40}
                height={40}
                className="w-full h-full object-cover object-top"
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-xl">
              {user?.name
                && user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
              }
            </div>
          )
        )}
        <ThemeChange vars={""} />
        <div className="scale-80 bg-popover rounded-full p-2 ">
          <LogoutConfirmation onClick={handleLogout} />
        </div>
      </div>
    </nav>
  );
});

Navbar.displayName = "Navbar";
export default Navbar;
