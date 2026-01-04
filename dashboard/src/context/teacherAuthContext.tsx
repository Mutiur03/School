import axios from "axios";
import { createContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import toast from "react-hot-toast";

interface Level {
    id: number;
    class_name: number;
    section: string;
    year: number;
}

interface Teacher {
    id: number;
    name: string;
    email: string;
    phone?: string;
    designation?: string;
    address?: string;
    image?: string;
    levels?: Level[];
}

interface TeacherAuthContextType {
    teacher: Teacher | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
}

const TeacherAuthContext = createContext<TeacherAuthContextType>({
    teacher: null,
    loading: true,
    login: async () => { },
    logout: async () => { },
    checkAuth: async () => { },
});

export const TeacherAuthProvider = ({ children }: { children: ReactNode }) => {
    const [teacher, setTeacher] = useState<Teacher | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        setLoading(true);
        try {
            axios.defaults.withCredentials = true;
            const res = await axios.get("/api/auth/teacher_me");
            setTeacher(res.data.user);
        } catch (error) {
            console.error("Error checking teacher authentication:", error);
            setTeacher(null);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email: string, password: string) => {
        try {
            axios.defaults.withCredentials = true;
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

    const logout = async () => {
        axios.defaults.withCredentials = true;
        try {
            const res = await axios.get("/api/auth/logout");
            toast.success(res.data.message || "Logged out successfully");
            setTeacher(null);
        } catch (error) {
            console.error("Error logging out:", error);
            toast.error("Error logging out");
        }
    };

    return (
        <TeacherAuthContext.Provider
            value={{ teacher, loading, login, logout, checkAuth }}
        >
            {children}
        </TeacherAuthContext.Provider>
    );
};

export default TeacherAuthContext;
