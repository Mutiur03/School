import envPreferredRole from "@/lib/role";
import axios from "axios";
import { createContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import toast from "react-hot-toast";

export type UserRole = "admin" | "teacher" | "student";

interface Level {
    id: number;
    class_name: number;
    section: string;
    year: number;
}

interface Enrollment {
    id: number;
    class: number;
    section: string;
    year: number;
}

interface BaseUser {
    role: UserRole;
}

interface AdminUser extends BaseUser {
    role: "admin";
    id: string;
    username: string;
    email: string;
}

interface TeacherUser extends BaseUser {
    role: "teacher";
    id: number;
    name: string;
    email: string;
    phone?: string;
    designation?: string;
    address?: string;
    image?: string;
    levels?: Level[];
}

interface StudentUser extends BaseUser {
    role: "student";
    id: number;
    name: string;
    login_id: number;
    email?: string;
    phone?: string;
    address?: string;
    image?: string;
    enrollments?: Enrollment[];
}

export type User = AdminUser | TeacherUser | StudentUser;

export type { AdminUser, TeacherUser, StudentUser };

interface UnifiedAuthContextType {
    user: User | null;
    loading: boolean;
    preferredRole: UserRole | null;
    loginAdmin: (username: string, password: string) => Promise<void>;
    loginTeacher: (email: string, password: string) => Promise<void>;
    loginStudent: (login_id: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
    setPreferredRole: (role: UserRole | null) => void;
    isAdmin: () => boolean;
    isTeacher: () => boolean;
    isStudent: () => boolean;
    hasRole: (role: UserRole) => boolean;
}

const UnifiedAuthContext = createContext<UnifiedAuthContextType>({
    user: null,
    loading: true,
    preferredRole: null,
    loginAdmin: async () => { },
    loginTeacher: async () => { },
    loginStudent: async () => { },
    logout: async () => { },
    checkAuth: async () => { },
    setPreferredRole: () => { },
    isAdmin: () => false,
    isTeacher: () => false,
    isStudent: () => false,
    hasRole: () => false,
});

export const UnifiedAuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [preferredRole, setPreferredRole] = useState<UserRole | null>(envPreferredRole);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        setLoading(true);
        try {
            axios.defaults.withCredentials = true;
            console.log(preferredRole);

            switch (preferredRole) {
                case "admin": {
                    try {
                        const adminRes = await axios.get("/api/auth/protected");
                        if (adminRes.data.user) {
                            setUser(adminRes.data.user as AdminUser);
                            setLoading(false);
                            return;
                        }
                    } catch {
                        void 0;
                    }
                    break;
                }
                case "teacher": {
                    try {
                        const teacherRes = await axios.get("/api/auth/teacher_me");
                        if (teacherRes.data.user) {
                            setUser(teacherRes.data.user as TeacherUser);
                            setLoading(false);
                            return;
                        }
                    } catch {
                        void 0;
                    }
                    break;
                }
                case "student": {
                    try {
                        const studentRes = await axios.get("/api/auth/student-protected");
                        if (studentRes.data.user) {
                            setUser(studentRes.data.user as StudentUser);
                            setLoading(false);
                            return;
                        }
                    } catch {
                        void 0;
                    }
                    break;
                }
            }
            if (preferredRole === null) {
                try {
                    const adminRes = await axios.get("/api/auth/protected");
                    if (adminRes.data.user) {
                        setUser(adminRes.data.user as AdminUser);
                        setLoading(false);
                        return;
                    }
                } catch {
                    void 0;
                }
                try {
                    const teacherRes = await axios.get("/api/auth/teacher_me");
                    if (teacherRes.data.user) {
                        setUser(teacherRes.data.user as TeacherUser);
                        setLoading(false);
                        return;
                    }
                } catch {
                    void 0;
                }
                try {
                    const studentRes = await axios.get("/api/auth/student-protected");
                    if (studentRes.data.user) {
                        setUser(studentRes.data.user as StudentUser);
                        setLoading(false);
                        return;
                    }
                } catch {
                    void 0;
                }
            }
            setUser(null);
        } catch (error) {
            console.error("Error checking authentication:", error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const loginAdmin = async (username: string, password: string) => {
        try {
            axios.defaults.withCredentials = true;
            setPreferredRole("admin");
            const res = await axios.post("/api/auth/login", {
                username,
                password,
            });
            if (res.data.success) toast.success(res.data.message);
            await checkAuth();
        } catch (error) {
            console.error("Error logging in:", error);
            toast.error("Invalid Credentials");
            throw error;
        }
    };

    const loginTeacher = async (email: string, password: string) => {
        try {
            axios.defaults.withCredentials = true;
            setPreferredRole("teacher");
            const res = await axios.post("/api/auth/teacher_login", {
                email,
                password,
            });
            if (res.data.success) {
                toast.success(res.data.message || "Login successful");
                await checkAuth();
            }
        } catch (error) {
            console.error("Error logging in:", error);
            toast.error("Invalid Credentials");
            throw error;
        }
    };

    const loginStudent = async (login_id: string, password: string) => {
        try {
            axios.defaults.withCredentials = true;
            setPreferredRole("student");
            const res = await axios.post("/api/auth/student_login", {
                login_id,
                password,
            });
            toast.success(res.data.message || "Login successful");
            await checkAuth();
        } catch (error) {
            console.error("Error logging in:", error);
            toast.error("Invalid Credentials");
            throw error;
        }
    };

    const logout = async () => {
        axios.defaults.withCredentials = true;
        try {
            const res = await axios.get("/api/auth/logout");
            toast.success(res.data.message || "Logged out successfully");
            setUser(null);
        } catch (error) {
            console.error("Error logging out:", error);
            toast.error("Error logging out");
        }
    };

    const isAdmin = () => user?.role === "admin";
    const isTeacher = () => user?.role === "teacher";
    const isStudent = () => user?.role === "student";
    const hasRole = (role: UserRole) => user?.role === role;

    return (
        <UnifiedAuthContext.Provider
            value={{
                user,
                loading,
                preferredRole,
                loginAdmin,
                loginTeacher,
                loginStudent,
                logout,
                checkAuth,
                setPreferredRole,
                isAdmin,
                isTeacher,
                isStudent,
                hasRole,
            }}
        >
            {children}
        </UnifiedAuthContext.Provider>
    );
};

export default UnifiedAuthContext;
