import { Navigate } from "react-router-dom";
import { useAuth } from "../context/appContext";
const PrivateRoute = ({ element }) => {
  const { user, loading } = useAuth();
  // console.log(user);
  if (loading)
    return <div className="flex items-center justify-center"></div>;
  return user ? element : <Navigate to="/login" />;
};

export default PrivateRoute;
