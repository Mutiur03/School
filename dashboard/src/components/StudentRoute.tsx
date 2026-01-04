import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useUnifiedAuth } from "@/context/useUnifiedAuth";

const StudentRoute = ({ element }: { element: ReactNode }) => {
    const { user, loading, isStudent } = useUnifiedAuth();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-lg">Loading...</div>
            </div>
        );
    }

    return user && isStudent() ? element : <Navigate to="/student/login" />;
};

export default StudentRoute;
