import axios from "axios";
import { createContext, useContext, useState, useEffect } from "react";
const AuthContext = createContext();
import toast from "react-hot-toast";
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Add loading state

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    setLoading(true); // Set loading to true before checking auth
    try {
      axios.defaults.withCredentials = true;
      const res = await axios.get("/api/auth/protected");
      setUser(res.data.user);
    } catch (error) {
      console.error("Error checking authentication:", error);
      setUser(null);
    } finally {
      setLoading(false); // Set loading to false after checking auth
    }
  };

  const login = async (username, password) => {
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

export const useAuth = () => useContext(AuthContext);
