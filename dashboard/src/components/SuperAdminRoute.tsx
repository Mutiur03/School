import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/context/useAuth";
import Loading from "./Loading";
import ServerOffline from "@/pages/Common/ServerOffline";

const SuperAdminRoute = ({ element }: { element: ReactNode }) => {
  const { user, loading, isSuperAdmin, serverOffline } = useAuth();

  if (loading && !user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loading />
      </div>
    );
  }

  return (
    <>
      {serverOffline && <ServerOffline isOverlay />}
      {user && isSuperAdmin() ? element : <Navigate to="/super_admin/login" />}
    </>
  );
};

export default SuperAdminRoute;
