"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import axios from "axios";
import { redirect, useRouter } from "next/navigation";

// Define Teacher type
export interface Teacher {
    id: number;
    name: string;
    email: string;
    phone?: string;
    department?: string;
    designation?: string;
    address?: string;
    image?: string;
    // ...add other fields as needed
}

// Context value type
interface AuthContextType {
    teacher: Teacher | null;
    loading: boolean;
    checkAuth: () => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [teacher, setTeacher] = useState<Teacher | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const router = useRouter();
    const checkAuth = async () => {
        setLoading(true);
        try {
            const res = await axios.get("http://localhost:3001/api/auth/teacher_me", { withCredentials: true });
            console.log("Authenticated Teacher:", res.data.teacher);

            setTeacher(res.data.teacher);
        } catch {
            setTeacher(null);
        }
        setLoading(false);
    };

    const logout = async () => {
        try {
            await axios.get("/api/auth/logout");
            router.push("/login");
            // setTeacher(null); // Remove this line here
            // Optionally, you can clear teacher info after navigation if needed
        } catch (error) {
            console.error("Error logging out:", error);
        }
    };

    useEffect(() => {
        checkAuth();
    }, []);

    return (
        <AuthContext.Provider value={{ teacher, loading, checkAuth, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AppProvider");
    }
    return context;
}
