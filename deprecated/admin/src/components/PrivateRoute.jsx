import { Navigate } from "react-router-dom";
import { useAuth } from "../context/authContext";

const PrivateRoute = ({ element }) => {
  const { user, loading } = useAuth();
  console.log(user);
  if (loading) return null;
  return user ? element : <Navigate to="/login" />;
};

export default PrivateRoute;
