import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/context/useAuth";
import Loading from "./Loading";
import ServerOffline from "@/pages/Common/ServerOffline";

const PrivateRoute = ({ element }: { element: ReactNode }) => {
  const { user, loading, isAdmin, serverOffline } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loading />
      </div>
    );
  }

  if (serverOffline) return <ServerOffline />;

  return user && isAdmin() ? element : <Navigate to="/login" />;
};

export default PrivateRoute;
