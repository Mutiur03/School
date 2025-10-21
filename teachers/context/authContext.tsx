"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import axios from "axios";
import { redirect, useRouter } from "next/navigation";

export interface Level {
    id: number;
    class_name: number;
    section: string;
    year: number;
}
export interface Teacher {
    id: number;
    name: string;
    email: string;
    phone?: string;
    department?: string;
    designation?: string;
    address?: string;
    image?: string;
    levels?: Level[]
}
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
            const res = await axios.get("/api/auth/teacher_me");
            console.log("Authenticated Teacher:", res.data.user);
            setTeacher(res.data.user);
        } catch (error) {
            console.error("Error fetching authenticated teacher: ", error);
            setTeacher(null);
            // await logout();
            redirect("/login");
        }
        finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            await axios.get("/api/auth/logout");
            router.push("/login");
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
