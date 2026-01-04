import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/context/useAuth";

const PrivateRoute = ({ element }: { element: ReactNode }) => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return user && isAdmin() ? element : <Navigate to="/login" />;
};

export default PrivateRoute;
