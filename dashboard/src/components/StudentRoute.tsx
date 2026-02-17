import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/context/useAuth";

const StudentRoute = ({ element }: { element: ReactNode }) => {
    const { user, loading, isStudent } = useAuth();

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
