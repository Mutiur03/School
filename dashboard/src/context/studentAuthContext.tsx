import axios from "axios";
import { createContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import toast from "react-hot-toast";

interface Enrollment {
    id: number;
    class: number;
    section: string;
    year: number;
}

interface Student {
    id: number;
    name: string;
    login_id: number;
    email?: string;
    phone?: string;
    address?: string;
    image?: string;
    enrollments?: Enrollment[];
}

interface StudentAuthContextType {
    student: Student | null;
    loading: boolean;
    login: (login_id: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
}

const StudentAuthContext = createContext<StudentAuthContextType>({
    student: null,
    loading: true,
    login: async () => { },
    logout: async () => { },
    checkAuth: async () => { },
});

export const StudentAuthProvider = ({ children }: { children: ReactNode }) => {
    const [student, setStudent] = useState<Student | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        setLoading(true);
        try {
            axios.defaults.withCredentials = true;
            const res = await axios.get("/api/auth/student-protected");
            setStudent(res.data.user);
        } catch (error) {
            console.error("Error checking student authentication:", error);
            setStudent(null);
        } finally {
            setLoading(false);
        }
    };

    const login = async (login_id: string, password: string) => {
        try {
            axios.defaults.withCredentials = true;
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
            setStudent(null);
        } catch (error) {
            console.error("Error logging out:", error);
            toast.error("Error logging out");
        }
    };

    return (
        <StudentAuthContext.Provider
            value={{ student, loading, login, logout, checkAuth }}
        >
            {children}
        </StudentAuthContext.Provider>
    );
};

export default StudentAuthContext;
