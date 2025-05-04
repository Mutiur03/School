import { createContext, useContext } from "react";
import { Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";

export const AppContext = createContext();

export default AppContext;

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState(null);
  useEffect(() => {
    checkAuth();
    fetchingdata();
  }, []);
  const checkAuth = async () => {
    setLoading(true);
    try {
      axios.defaults.withCredentials = true;
      const res = await axios.get("/api/auth/student-protected");
      setUser(res.data.user);
      await fetchingdata();
    } catch (error) {
      console.error("Error checking authentication:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };
  const fetchingdata = async () => {
    try {
      setLoading(true);

      axios.defaults.withCredentials = true;
      const response = await axios.get("/api/students/getStudent");
      const data = response.data.data;
      console.log("Student data:", data);
      
      setStudent(data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    axios.defaults.withCredentials = true;
    axios
      .get("/api/auth/logout")
      .then(() => {
        setUser(null);
        setStudent(null);
      })
      .catch((error) => {
        console.error("Error logging out:", error);
      });
  };
  const [sidebarExpanded, setSidebarExpanded] = useState(
    window.innerWidth >= 768
  );
  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        loading,
        checkAuth,
        logout,
        student,
        fetchingdata,
        sidebarExpanded,
        setSidebarExpanded,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAuth = () => useContext(AppContext);
