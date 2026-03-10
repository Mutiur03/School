import envPreferredRole from "@/lib/role";
import axios from "axios";
import { createContext, useEffect, useState, useRef } from "react";
import type { ReactNode } from "react";
import toast from "react-hot-toast";
import backend from "@/lib/backend";
import { getErrorMessage } from "@/lib/utils";

// Extend axios config to support custom flags
declare module "axios" {
    interface AxiosRequestConfig {
        _skipAuthRefresh?: boolean;
        _retry?: boolean;
    }
}

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
    accessToken: string | null;
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
    accessToken: null,
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
    const [preferredRole, setPreferredRole] = useState<UserRole | null>(
        envPreferredRole
    );
    const [accessToken, setAccessTokenState] = useState<string | null>(null);
    const tokenRef = useRef<string | null>(null);

    const setAccessToken = (token: string | null) => {
        tokenRef.current = token;
        setAccessTokenState(token);
    };

    useEffect(() => {
        const requestInterceptor = axios.interceptors.request.use(
            (config) => {
                const isExternal = config.url?.startsWith("http");
                const isBackend = !isExternal || config.url?.startsWith(backend);

                if (tokenRef.current && isBackend) {
                    config.headers.Authorization = `Bearer ${tokenRef.current}`;
                }

                if (isBackend) {
                    config.withCredentials = true; // Still needed for refreshToken cookie
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        const responseInterceptor = axios.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;

                // Handle Blob error responses globally
                if (error.response?.data instanceof Blob && error.response.data.type === "application/json") {
                    try {
                        const text = await error.response.data.text();
                        const parsedData = JSON.parse(text);
                        // Attach the parsed data back to the error object so downstream catch blocks can access it normally
                        error.response.data = parsedData;
                    } catch (e) {
                        console.error("Failed to parse error blob as JSON:", e);
                    }
                }

                // Skip refresh logic if flagged or if already retried
                if (error.response?.status === 401 && !originalRequest._retry && !originalRequest._skipAuthRefresh) {
                    originalRequest._retry = true;
                    try {
                        const { data } = await axios.post("/api/auth/sessions/refresh");
                        const accessToken = data?.data?.accessToken;
                        const refreshedUser = data?.data?.user;
                        if (data.success && accessToken) {
                            setAccessToken(accessToken);
                            if (refreshedUser) setUser(refreshedUser);
                            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                            return axios(originalRequest);
                        }
                    } catch (refreshError) {
                        console.error("Token refresh failed:", refreshError);
                    }
                    // Refresh failed or returned success:false — clear auth state
                    setUser(null);
                    setAccessToken(null);
                }
                return Promise.reject(error);
            }
        );

        return () => {
            axios.interceptors.request.eject(requestInterceptor);
            axios.interceptors.response.eject(responseInterceptor);
        };
    }, []);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        setLoading(true);
        try {
            // Try to refresh token first to check if session exists
            // Use direct axios call to avoid interceptor recursion
            const refreshRes = await axios.post("/api/auth/sessions/refresh", {}, {
                _skipAuthRefresh: true // Flag to bypass interceptor refresh
            });

            const accessToken = refreshRes.data?.data?.accessToken;
            const userData = refreshRes.data?.data?.user;
            if (refreshRes.data.success && accessToken) {
                setAccessToken(accessToken);
                setUser(userData);
                if (userData?.role) {
                    setPreferredRole(userData.role as UserRole);
                }
                setLoading(false);
                return;
            }
        } catch {
            // failed to refresh — no active session
            console.log("No active refresh session found");
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const loginAdmin = async (username: string, password: string) => {
        try {
            axios.defaults.withCredentials = true;
            setPreferredRole("admin");
            const res = await axios.post("/api/auth/admin/sessions", {
                username,
                password,
            });
            if (res.data.success) {
                toast.success(res.data.message);
                setAccessToken(res.data?.data?.accessToken);
                setUser(res.data?.data?.user);
            } else {
                toast.error(res.data.message || "Invalid Credentials");
                throw new Error(res.data.message || "Login failed");
            }
        } catch (error) {
            console.error("Error logging in:", error);
            toast.error(getErrorMessage(error));
            throw error;
        }
    };

    const loginTeacher = async (email: string, password: string) => {
        try {
            axios.defaults.withCredentials = true;
            setPreferredRole("teacher");
            const res = await axios.post("/api/auth/teacher/sessions", {
                email,
                password,
            });
            if (res.data.success) {
                toast.success(res.data.message || "Login successful");
                setAccessToken(res.data?.data?.accessToken);
                setUser(res.data?.data?.user);
            }
        } catch (error) {
            console.error("Error logging in:", error);
            toast.error(getErrorMessage(error));
            throw error;
        }
    };

    const loginStudent = async (login_id: string, password: string) => {
        try {
            axios.defaults.withCredentials = true;
            setPreferredRole("student");
            const res = await axios.post("/api/auth/student/sessions", {
                login_id,
                password,
            });
            toast.success(res.data.message || "Login successful");
            setAccessToken(res.data?.data?.accessToken);
            setUser(res.data?.data?.user);
        } catch (error) {
            console.error("Error logging in:", error);
            toast.error(getErrorMessage(error));
            throw error;
        }
    };

    const logout = async () => {
        axios.defaults.withCredentials = true;
        try {
            const res = await axios.delete("/api/auth/sessions");
            toast.success(res.data.message || "Logged out successfully");
            setUser(null);
            setAccessToken(null);
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
                accessToken,
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
