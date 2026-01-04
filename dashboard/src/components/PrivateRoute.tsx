import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useUnifiedAuth } from "@/context/useUnifiedAuth";

const PrivateRoute = ({ element }: { element: ReactNode }) => {
  const { user, loading, isAdmin } = useUnifiedAuth();

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
