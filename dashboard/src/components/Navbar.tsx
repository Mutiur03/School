import { forwardRef } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import LogoutConfirmation from "@/components/LogOutConfirmation";
import { Menu } from "lucide-react";
import { useAuth } from "@/context/useAuth";
import { getInitials } from "@/lib/utils";
import envPreferredRole from "@/lib/role";
import { getFileUrl } from "@/lib/backend";
import useNavigationStore from "@/store/navigation.Store";

interface NavbarProps {
  onBurgerClick?: () => void;
}

const Navbar = forwardRef<HTMLElement, NavbarProps>(({ onBurgerClick }, ref) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const { isDirty, resetDirty } = useNavigationStore();

  const handleNavigation = (e?: React.MouseEvent) => {
    if (isDirty) {
      const proceed = window.confirm(
        "You have unsaved attendance changes. Leaving this page will discard them. Are you sure you want to proceed?"
      );
      if (!proceed) {
        if (e) e.preventDefault();
        return false;
      }
      resetDirty();
    }
    return true;
  };

  const handleLogout = async () => {
    if (!handleNavigation()) return;
    try {
      await logout();
      const rolePath = envPreferredRole
        ? (envPreferredRole === "super_admin" ? "super_admin" : envPreferredRole)
        : (user?.role === "super_admin" ? "super_admin" : user?.role);
      navigate(`/${rolePath}/login`);
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
        className="md:hidden mr-2 p-2 rounded focus:outline-none focus:ring-2 focus:ring-ring"
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
        <Link to="/admin" onClick={handleNavigation} className="text-xl text-nowrap flex items-center">
          Admin
        </Link>}
      {user && user.role === "super_admin" &&
        <Link to="/super_admin" onClick={handleNavigation} className="text-xl text-nowrap flex items-center">
          Super Admin
        </Link>}
      {user && user.role === "teacher" &&
        <Link to="/teacher" onClick={handleNavigation} className="text-xl text-nowrap flex items-center">
          Teacher's Dashboard
        </Link>}
      {user && user.role === "student" &&
        <Link to="/student" onClick={handleNavigation} className="text-xl text-nowrap flex items-center">
          Student's Dashboard
        </Link>}
      <div className="flex items-center justify-between">
        {user && user.role === "teacher" && (
          user?.image ? (
            <div className="w-10 h-10 rounded-full border-4 border-border shadow-sm overflow-hidden">
              <img
                src={getFileUrl(user.image)}
                alt="Profile"
                width={40}
                height={40}
                className="w-full h-full object-cover object-top"
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground border-2 border-border">
              {getInitials(user?.name)}
            </div>
          )
        )}
        {/* <ThemeChange vars={""} /> */}
        <div className="scale-80 bg-popover rounded-full p-2 ">
          <LogoutConfirmation onClick={handleLogout} />
        </div>
      </div>
    </nav>
  );
});

export default Navbar;
