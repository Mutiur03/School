import envPreferredRole from "@/lib/role";
import axios from "axios";
import { createContext, useEffect, useState, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import toast from "react-hot-toast";
import backend from "@/lib/backend";
import { syncSentryUser } from "@/lib/sentry";
import { getErrorMessage } from "@/lib/utils";

// Extend axios config to support custom flags
declare module "axios" {
    interface AxiosRequestConfig {
        _skipAuthRefresh?: boolean;
        _skipOfflineDetect?: boolean;
        _retry?: boolean;
    }
}

export type UserRole = "admin" | "teacher" | "student" | "super_admin";

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
    signature?: string;
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

interface SuperAdminUser extends BaseUser {
    role: "super_admin";
    id: number;
    email: string;
}

export type User = AdminUser | TeacherUser | StudentUser | SuperAdminUser;

export type { AdminUser, TeacherUser, StudentUser, SuperAdminUser };

interface UnifiedAuthContextType {
    user: User | null;
    loading: boolean;
    serverOffline: boolean;
    preferredRole: UserRole | null;
    accessToken: string | null;
    loginAdmin: (username: string, password: string) => Promise<void>;
    loginSuperAdmin: (email: string, password: string) => Promise<void>;
    loginTeacher: (email: string, password: string) => Promise<void>;
    loginStudent: (login_id: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
    retryAuth: () => void;
    setPreferredRole: (role: UserRole | null) => void;
    isAdmin: () => boolean;
    isSuperAdmin: () => boolean;
    isTeacher: () => boolean;
    isStudent: () => boolean;
    hasRole: (role: UserRole) => boolean;
}

type ErrorWithResponse = {
    response?: {
        status?: number;
        data?: {
            message?: string;
        };
    };
    code?: string;
    message?: string;
};

const isErrorWithResponse = (error: unknown): error is ErrorWithResponse =>
    typeof error === "object" && error !== null;

const isNetworkError = (error: unknown): boolean => {
    if (!isErrorWithResponse(error)) return false;
    return !error.response &&
        (error.code === "ERR_NETWORK" || error.message === "Network Error");
};

const getErrorStatus = (error: unknown) =>
    (isErrorWithResponse(error) ? error.response?.status : undefined);

const getResponseMessage = (error: unknown) => {
    if (isErrorWithResponse(error)) {
        return error.response?.data?.message || error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
};

const UnifiedAuthContext = createContext<UnifiedAuthContextType>({
    user: null,
    loading: true,
    serverOffline: false,
    preferredRole: null,
    accessToken: null,
    loginAdmin: async () => { },
    loginSuperAdmin: async () => { },
    loginTeacher: async () => { },
    loginStudent: async () => { },
    logout: async () => { },
    checkAuth: async () => { },
    retryAuth: () => { },
    setPreferredRole: () => { },
    isAdmin: () => false,
    isSuperAdmin: () => false,
    isTeacher: () => false,
    isStudent: () => false,
    hasRole: () => false,
});

export const UnifiedAuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [serverOffline, setServerOffline] = useState(false);
    const [preferredRole, setPreferredRole] = useState<UserRole | null>(
        envPreferredRole
    );
    const [accessToken, setAccessTokenState] = useState<string | null>(null);
    const accessTokenRef = useRef<string | null>(null);
    const retryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const setAccessToken = (token: string | null) => {
        accessTokenRef.current = token;
        setAccessTokenState(token);
    };

    const refreshSession = useCallback((timeout?: number) => {
        return axios.post("/api/auth/sessions/refresh", {}, {
            _skipAuthRefresh: true,
            timeout,
        });
    }, []);

    const isSuperAdminAllowed = () => envPreferredRole === "super_admin";

    useEffect(() => {
        const requestInterceptor = axios.interceptors.request.use(
            (config) => {
                const isExternal = config.url?.startsWith("http");
                const isBackend = !isExternal || (!!backend && config.url?.startsWith(backend));

                if (isBackend) {
                    config.withCredentials = true; // Refresh cookie only; access token stays in memory.
                    if (!config._skipAuthRefresh && accessTokenRef.current) {
                        config.headers = config.headers || {};
                        config.headers.Authorization = `Bearer ${accessTokenRef.current}`;
                    }
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        const responseInterceptor = axios.interceptors.response.use(
            (response) => {
                // If we get any successful response, server is back online
                if (serverOffline) setServerOffline(false);
                return response;
            },
            async (error) => {
                const originalRequest = error.config;

                // Detect network errors (server unreachable)
                if (isNetworkError(error) && !originalRequest?._skipOfflineDetect) {
                    setServerOffline(true);
                    return Promise.reject(error);
                }

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
                        const { data } = await refreshSession();
                        const refreshedUser = data?.data?.user;
                        const refreshedAccessToken = data?.data?.accessToken;
                        if (data.success && refreshedUser) {
                            if (refreshedUser?.role === "super_admin" && !isSuperAdminAllowed()) {
                                setAccessToken(null);
                                setUser(null);
                                return Promise.reject(new Error("Super admin login is disabled for this panel."));
                            }

                            setAccessToken(refreshedAccessToken ?? null);
                            setUser(refreshedUser);
                            if (refreshedAccessToken) {
                                originalRequest.headers = originalRequest.headers || {};
                                originalRequest.headers.Authorization = `Bearer ${refreshedAccessToken}`;
                            }
                            return axios(originalRequest);
                        }
                    } catch (refreshError) {
                        // If refresh itself is a network error, mark offline
                        if (isNetworkError(refreshError)) {
                            console.warn("Refresh request failed: Network Error (Offline)");
                            setServerOffline(true);
                            return Promise.reject(refreshError);
                        }

                        const status = getErrorStatus(refreshError);
                        const message = getResponseMessage(refreshError);
                        console.error(`Refresh failed with status ${status}:`, message);

                        if (status === 429) {
                            toast.error("Rate limit hit. Please wait a moment.");
                        }
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
    }, [refreshSession, serverOffline]);

    const checkAuth = useCallback(async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            // Try to refresh token first to check if session exists
            // Use direct axios call to avoid interceptor recursion
            const refreshRes = await refreshSession();

            const userData = refreshRes.data?.data?.user;
            const refreshedAccessToken = refreshRes.data?.data?.accessToken;
            if (refreshRes.data.success && userData) {
                if (userData?.role === "super_admin" && !isSuperAdminAllowed()) {
                    setAccessToken(null);
                    setUser(null);
                    setServerOffline(false);
                    setLoading(false);
                    return;
                }

                setAccessToken(refreshedAccessToken ?? null);
                setUser(userData);
                setServerOffline(false);
                if (userData?.role) {
                    setPreferredRole(userData.role as UserRole);
                }
                setLoading(false);
                return;
            }

            // Auth failure — no active session
            console.log("No active refresh session found");
            setUser(null);
            setServerOffline(false);
        } catch (error: unknown) {
            // Distinguish: network error vs auth failure
            if (isNetworkError(error)) {
                console.warn("Initial checkAuth failed: Network Error (Offline)");
                setServerOffline(true);
                // Do NOT clear user — keep existing auth state if any
            } else {
                // Auth failure — no active session
                const status = getErrorStatus(error);
                const message = getResponseMessage(error);
                console.warn(`No active session found (Status ${status}):`, message);

                setUser(null);
                setServerOffline(false);
            }
        } finally {
            setLoading(false);
        }
    }, [refreshSession]);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    useEffect(() => {
        syncSentryUser(user);
    }, [user]);

    // Auto-retry polling when server is offline
    useEffect(() => {
        if (serverOffline) {
            retryIntervalRef.current = setInterval(async () => {
                try {
                    await refreshSession(5000);
                    // If we get here, server is back
                    setServerOffline(false);
                    checkAuth();
                } catch {
                    // Still offline, keep polling
                }
            }, 5000);
        } else {
            if (retryIntervalRef.current) {
                clearInterval(retryIntervalRef.current);
                retryIntervalRef.current = null;
            }
        }

        return () => {
            if (retryIntervalRef.current) {
                clearInterval(retryIntervalRef.current);
                retryIntervalRef.current = null;
            }
        };
    }, [checkAuth, refreshSession, serverOffline]);

    const retryAuth = () => {
        setServerOffline(false);
        checkAuth();
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
                toast.success("Login successful");
                setAccessToken(res.data?.data?.accessToken ?? null);
                if (res.data?.data?.user) {
                    setUser(res.data.data.user);
                } else {
                    await checkAuth(false);
                }
            } else {
                throw { response: { data: res.data } };
            }
        } catch (error) {
            console.error("Error logging in:", error);
            toast.error(getErrorMessage(error));
            throw error;
        }
    };

    const loginSuperAdmin = async (email: string, password: string) => {
        try {
            if (!isSuperAdminAllowed()) {
                throw new Error("Super admin login is disabled unless VITE_DEFAULT_ROLE=super_admin.");
            }

            axios.defaults.withCredentials = true;
            setPreferredRole("super_admin");
            const res = await axios.post("/api/auth/super_admin/sessions", {
                email,
                password,
            });
            if (res.data.success) {
                toast.success(res.data.message || "Login successful");
                setAccessToken(res.data?.data?.accessToken ?? null);
                if (res.data?.data?.user) {
                    setUser(res.data.data.user);
                } else {
                    await checkAuth(false);
                }
            } else {
                throw { response: { data: res.data } };
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
                setAccessToken(res.data?.data?.accessToken ?? null);
                if (res.data?.data?.user) {
                    setUser(res.data.data.user);
                } else {
                    await checkAuth(false);
                }
            } else {
                throw { response: { data: res.data } };
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
            if (res.data.success) {
                toast.success(res.data.message || "Login successful");
                setAccessToken(res.data?.data?.accessToken ?? null);
                if (res.data?.data?.user) {
                    setUser(res.data.data.user);
                } else {
                    await checkAuth(false);
                }
            } else {
                throw { response: { data: res.data } };
            }
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
            setUser(null);
            setAccessToken(null);
        }
    };

    const isAdmin = () => user?.role === "admin";
    const isSuperAdmin = () => user?.role === "super_admin";
    const isTeacher = () => user?.role === "teacher";
    const isStudent = () => user?.role === "student";
    const hasRole = (role: UserRole) => user?.role === role;

    return (
        <UnifiedAuthContext.Provider
            value={{
                user,
                loading,
                serverOffline,
                preferredRole,
                accessToken,
                loginAdmin,
                loginSuperAdmin,
                loginTeacher,
                loginStudent,
                logout,
                checkAuth,
                retryAuth,
                setPreferredRole,
                isAdmin,
                isSuperAdmin,
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
