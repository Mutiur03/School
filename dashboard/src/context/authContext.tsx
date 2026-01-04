import axios from "axios";
import { createContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
interface User {
  id: string;
  username: string;
  email: string;
}
interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => { },
  logout: async () => { },
  setUser: () => { },
});
import toast from "react-hot-toast";
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    setLoading(true);
    try {
      axios.defaults.withCredentials = true;
      const res = await axios.get("/api/auth/protected");
      setUser(res.data.user);
    } catch (error) {
      console.error("Error checking authentication:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      axios.defaults.withCredentials = true;
      console.log(username, password);
      const res = await axios.post("/api/auth/login", {
        username,
        password,
      });
      console.log(res);
      if (res.data.success) toast.success(res.data.message);
      checkAuth();
    } catch (error) {
      console.error("Error logging in:", error);
      toast.error("Invalid Credentials");
    }
  };

  const logout = async () => {
    axios.defaults.withCredentials = true;
    console.log("Logging out...");
    try {
      const res = await axios.get("/api/auth/logout");
      toast.success(res.data.message);
      setUser(null);
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};


export { AuthContext };