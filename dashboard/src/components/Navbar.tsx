import { forwardRef, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import LogoutConfirmation from "@/components/LogOutConfirmation";
import ConfirmationPopup from "@/components/ConfirmationPopup";
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
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveIsLogout, setLeaveIsLogout] = useState(false);
  const pendingAction = useRef<"logout" | string | null>(null);

  const requestLeave = (e: React.MouseEvent | undefined, action: "logout" | string) => {
    if (!isDirty) return true;
    e?.preventDefault();
    pendingAction.current = action;
    setLeaveIsLogout(action === "logout");
    setLeaveOpen(true);
    return false;
  };

  const confirmLeave = async () => {
    const action = pendingAction.current;
    pendingAction.current = null;
    setLeaveOpen(false);
    resetDirty();
    if (action === "logout") {
      try {
        await logout();
        const rolePath = envPreferredRole
          ? (envPreferredRole === "super_admin" ? "super_admin" : envPreferredRole)
          : (user?.role === "super_admin" ? "super_admin" : user?.role);
        navigate(`/${rolePath}/login`);
      } catch (error) {
        console.error("Logout failed:", error);
        toast.error("Failed to logout. Please try again.");
      }
      return;
    }
    if (typeof action === "string") navigate(action);
  };

  const handleLogout = async () => {
    if (!requestLeave(undefined, "logout")) return;
    try {
      await logout();
      const rolePath = envPreferredRole
        ? (envPreferredRole === "super_admin" ? "super_admin" : envPreferredRole)
        : (user?.role === "super_admin" ? "super_admin" : user?.role);
      navigate(`/${rolePath}/login`);
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
      <ConfirmationPopup
        open={leaveOpen}
        onOpenChange={(open) => {
          setLeaveOpen(open);
          if (!open) {
            pendingAction.current = null;
            setLeaveIsLogout(false);
          }
        }}
        onConfirm={confirmLeave}
        title="Leave without saving?"
        msg="You have unsaved attendance changes. Leaving this page will discard them."
        confirmLabel={leaveIsLogout ? "Discard & Log Out" : "Discard & Leave"}
        cancelLabel="Stay"
        variant="destructive"
      />
      <button
        className="md:hidden mr-2 p-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => {
          if (onBurgerClick) onBurgerClick();
        }}
        aria-label="Open sidebar"
        type="button"
      >
        <Menu className="w-6 h-6" />
      </button>
      {user && user.role === "admin" && (
        <Link
          to="/admin"
          onClick={(e) => {
            if (!requestLeave(e, "/admin")) return;
          }}
          className="text-xl text-nowrap flex items-center"
        >
          Admin
        </Link>
      )}
      {user && user.role === "super_admin" && (
        <Link
          to="/super_admin"
          onClick={(e) => {
            if (!requestLeave(e, "/super_admin")) return;
          }}
          className="text-xl text-nowrap flex items-center"
        >
          Super Admin
        </Link>
      )}
      {user && user.role === "teacher" && (
        <Link
          to="/teacher"
          onClick={(e) => {
            if (!requestLeave(e, "/teacher")) return;
          }}
          className="text-xl text-nowrap flex items-center"
        >
          Teacher&apos;s Dashboard
        </Link>
      )}
      {user && user.role === "student" && (
        <Link
          to="/student"
          onClick={(e) => {
            if (!requestLeave(e, "/student")) return;
          }}
          className="text-xl text-nowrap flex items-center"
        >
          Student&apos;s Dashboard
        </Link>
      )}
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
        <div className="scale-80 bg-popover rounded-full p-2 ">
          <LogoutConfirmation onClick={handleLogout} />
        </div>
      </div>
    </nav>
  );
});

Navbar.displayName = "Navbar";

export default Navbar;
