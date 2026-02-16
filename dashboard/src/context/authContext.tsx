// import axios from "axios";
// import { createContext, useState, useEffect } from "react";
// import type { ReactNode } from "react";
// interface User {
//   id: string;
//   username: string;
//   email: string;
// }
// interface AuthContextType {
//   user: User | null;
//   loading: boolean;
//   accessToken: string | null;
//   login: (username: string, password: string) => Promise<void>;
//   logout: () => Promise<void>;
//   setUser: (user: User) => void;
// }

// const AuthContext = createContext<AuthContextType>({
//   user: null,
//   loading: true,
//   accessToken: null,
//   login: async () => { },
//   logout: async () => { },
//   setUser: () => { },
// });
// import toast from "react-hot-toast";

// export const AuthProvider = ({ children }: { children: ReactNode }) => {
//   const [user, setUser] = useState<User | null>(null);
//   const [accessToken, setAccessToken] = useState<string | null>(null);
//   const [loading, setLoading] = useState(true);

//   // Configure Axios Interceptors
//   useEffect(() => {
//     const requestInterceptor = axios.interceptors.request.use(
//       (config) => {
//         if (accessToken) {
//           config.headers.Authorization = `Bearer ${accessToken}`;
//         }
//         config.withCredentials = true;
//         return config;
//       },
//       (error) => Promise.reject(error)
//     );

//     const responseInterceptor = axios.interceptors.response.use(
//       (response) => response,
//       async (error) => {
//         const originalRequest = error.config;

//         // Prevent infinite loops
//         if (error.response?.status === 401 && !originalRequest._retry) {
//           originalRequest._retry = true;

//           try {
//             const res = await axios.post("/api/auth/refresh");
//             if (res.data.success && res.data.accessToken) {
//               const newAccessToken = res.data.accessToken;
//               setAccessToken(newAccessToken);
//               if (res.data.user) setUser(res.data.user); // Optional: update user if returned

//               // Retry original request with new token
//               originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
//               return axios(originalRequest);
//             }
//           } catch (refreshError) {
//             console.error("Refresh token failed:", refreshError);
//             setUser(null);
//             setAccessToken(null);
//           }
//         }
//         return Promise.reject(error);
//       }
//     );

//     return () => {
//       axios.interceptors.request.eject(requestInterceptor);
//       axios.interceptors.response.eject(responseInterceptor);
//     };
//   }, [accessToken]); // Re-create interceptors when token changes to ensure latest state (though ref might be better, this works)

//   useEffect(() => {
//     checkAuth();
//   }, []);

//   const checkAuth = async () => {
//     setLoading(true);
//     try {
//       // First try to refresh to get initial access token
//       const refreshRes = await axios.post("/api/auth/refresh");

//       if (refreshRes.data.success && refreshRes.data.accessToken) {
//         setAccessToken(refreshRes.data.accessToken);
//         setUser(refreshRes.data.user);
//       } else {
//         // Fallback or just stop
//         setUser(null);
//       }

//     } catch (error) {
//       console.error("Error checking authentication:", error);
//       setUser(null);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const login = async (username: string, password: string) => {
//     try {
//       axios.defaults.withCredentials = true;
//       console.log(username, password);
//       const res = await axios.post("/api/auth/login", {
//         username,
//         password,
//       });
//       console.log(res);
//       if (res.data.success) {
//         toast.success(res.data.message);
//         setAccessToken(res.data.accessToken);
//         setUser(res.data.user); // The login response now returns user
//       }
//     } catch (error) {
//       console.error("Error logging in:", error);
//       toast.error("Invalid Credentials");
//     }
//   };

//   const logout = async () => {
//     axios.defaults.withCredentials = true;
//     console.log("Logging out...");
//     try {
//       const res = await axios.get("/api/auth/logout");
//       toast.success(res.data.message);
//       setUser(null);
//       setAccessToken(null);
//     } catch (error) {
//       console.error("Error logging out:", error);
//     }
//   };

//   return (
//     <AuthContext.Provider value={{ user, loading, accessToken, login, logout, setUser }}>
//       {children}
//     </AuthContext.Provider>
//   );
// };


// // export { AuthContext };