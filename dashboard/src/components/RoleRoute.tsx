import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/context/useAuth';
import type { UserRole } from '@/context/unifiedAuthContext';
import Loading from './Loading';
import ServerOffline from '@/pages/Common/ServerOffline';

const checkByRole: Record<UserRole, (auth: ReturnType<typeof useAuth>) => boolean> = {
  admin: (a) => a.isAdmin(),
  teacher: (a) => a.isTeacher(),
  student: (a) => a.isStudent(),
  super_admin: (a) => a.isSuperAdmin(),
};

const loginByRole: Record<UserRole, string> = {
  admin: '/admin/login',
  teacher: '/teacher/login',
  student: '/student/login',
  super_admin: '/super_admin/login',
};

/** One guard for all roles — replaces Private/Teacher/Student/SuperAdminRoute. */
const RoleRoute = ({ role, element }: { role: UserRole; element: ReactNode }) => {
  const auth = useAuth();
  const { user, loading, serverOffline } = auth;

  if (loading && !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loading />
      </div>
    );
  }

  return (
    <>
      {serverOffline && <ServerOffline isOverlay />}
      {user && checkByRole[role](auth) ? element : <Navigate to={loginByRole[role]} />}
    </>
  );
};

export default RoleRoute;
