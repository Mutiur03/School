import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/context/useAuth";

const TeacherRoute = ({ element }: { element: ReactNode }) => {
    const { user, loading, isTeacher } = useAuth();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-lg">Loading...</div>
            </div>
        );
    }

    return user && isTeacher() ? element : <Navigate to="/teacher/login" />;
};

export default TeacherRoute;
