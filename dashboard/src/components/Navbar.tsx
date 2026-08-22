import { forwardRef, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import LogoutConfirmation from '@/components/LogOutConfirmation';
import ConfirmationPopup from '@/components/ConfirmationPopup';
import { Menu } from 'lucide-react';
import { useAuth } from '@/context/useAuth';
import { getInitials } from '@/lib/utils';
import envPreferredRole from '@/lib/role';
import { getFileUrl } from '@/lib/backend';
import useNavigationStore from '@/store/navigation.Store';

interface NavbarProps {
  onBurgerClick?: () => void;
}

const Navbar = forwardRef<HTMLElement, NavbarProps>(({ onBurgerClick }, ref) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const { isDirty, resetDirty } = useNavigationStore();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveIsLogout, setLeaveIsLogout] = useState(false);
  const pendingAction = useRef<'logout' | string | null>(null);

  const requestLeave = (e: React.MouseEvent | undefined, action: 'logout' | string) => {
    if (!isDirty) return true;
    e?.preventDefault();
    pendingAction.current = action;
    setLeaveIsLogout(action === 'logout');
    setLeaveOpen(true);
    return false;
  };

  const confirmLeave = async () => {
    const action = pendingAction.current;
    pendingAction.current = null;
    setLeaveOpen(false);
    resetDirty();
    if (action === 'logout') {
      try {
        await logout();
        const rolePath = envPreferredRole
          ? envPreferredRole === 'super_admin'
            ? 'super_admin'
            : envPreferredRole
          : user?.role === 'super_admin'
            ? 'super_admin'
            : user?.role;
        navigate(`/${rolePath}/login`);
      } catch (error) {
        console.error('Logout failed:', error);
        toast.error('Failed to logout. Please try again.');
      }
      return;
    }
    if (typeof action === 'string') navigate(action);
  };

  const handleLogout = async () => {
    if (!requestLeave(undefined, 'logout')) return;
    try {
      await logout();
      const rolePath = envPreferredRole
        ? envPreferredRole === 'super_admin'
          ? 'super_admin'
          : envPreferredRole
        : user?.role === 'super_admin'
          ? 'super_admin'
          : user?.role;
      navigate(`/${rolePath}/login`);
    } catch (error) {
      console.error('Logout failed:', error);
      toast.error('Failed to logout. Please try again.');
    }
  };

  return (
    <nav
      ref={ref}
      className="navbar bg-sidebar border-border sticky top-0 z-40 flex h-[3.5rem] w-full items-center justify-between border-b px-5 shadow-md backdrop-blur-xl"
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
        confirmLabel={leaveIsLogout ? 'Discard & Log Out' : 'Discard & Leave'}
        cancelLabel="Stay"
        variant="destructive"
      />
      <button
        className="focus-visible:ring-ring mr-2 rounded p-2 focus:outline-none focus-visible:ring-2 md:hidden"
        onClick={() => {
          if (onBurgerClick) onBurgerClick();
        }}
        aria-label="Open sidebar"
        type="button"
      >
        <Menu className="h-6 w-6" />
      </button>
      {user && user.role === 'admin' && (
        <Link
          to="/admin"
          onClick={(e) => {
            if (!requestLeave(e, '/admin')) return;
          }}
          className="flex items-center text-xl text-nowrap"
        >
          Admin
        </Link>
      )}
      {user && user.role === 'super_admin' && (
        <Link
          to="/super_admin"
          onClick={(e) => {
            if (!requestLeave(e, '/super_admin')) return;
          }}
          className="flex items-center text-xl text-nowrap"
        >
          Super Admin
        </Link>
      )}
      {user && user.role === 'teacher' && (
        <Link
          to="/teacher"
          onClick={(e) => {
            if (!requestLeave(e, '/teacher')) return;
          }}
          className="flex items-center text-xl text-nowrap"
        >
          Teacher&apos;s Dashboard
        </Link>
      )}
      {user && user.role === 'student' && (
        <Link
          to="/student"
          onClick={(e) => {
            if (!requestLeave(e, '/student')) return;
          }}
          className="flex items-center text-xl text-nowrap"
        >
          Student&apos;s Dashboard
        </Link>
      )}
      <div className="flex items-center justify-between">
        {user &&
          user.role === 'teacher' &&
          (user?.image ? (
            <div className="border-border h-10 w-10 overflow-hidden rounded-full border-4 shadow-sm">
              <img
                src={getFileUrl(user.image)}
                alt="Profile"
                width={40}
                height={40}
                className="h-full w-full object-cover object-top"
              />
            </div>
          ) : (
            <div className="bg-muted text-muted-foreground border-border flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold">
              {getInitials(user?.name)}
            </div>
          ))}
        <div className="bg-popover scale-80 rounded-full p-2">
          <LogoutConfirmation onClick={handleLogout} />
        </div>
      </div>
    </nav>
  );
});

Navbar.displayName = 'Navbar';

export default Navbar;
