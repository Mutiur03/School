import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import { Toaster } from "react-hot-toast";
import PrivateRoute from "./components/PrivateRoutes";
import StudentProfile from "./pages/StudentProfile";
import ChangePasswordPage from "./pages/ChangePassword";
import Result from "./pages/Result";
import axios from "axios";
import UploadPage from "./pages/UploadPage";
import RejectedPage from "./pages/RejectedPage";
import PendingPage from "./pages/PendingPage";
function App() {
  axios.defaults.baseURL = import.meta.env.VITE_BACKEND_URL;
  return (
    <>
      <Toaster
        position="top-right"
        reverseOrder={false}
        toastOptions={{ style: { marginTop: "50px" } }}
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="*"
          element={
            <PrivateRoute
              element={
                <>
                  <Navbar />
                  <Sidebar />
                  <div
                    className={`px-[3rem] p-[2rem] ml-[4rem] w-[calc(100%-4rem)] md:ml-[15rem] md:w-[calc(100%-15rem)] transition-all duration-100`}
                  >
                    <Routes>
                      <Route
                        path="/"
                        element={
                          <div>
                            <h1>Dashboard</h1>
                          </div>
                        }
                      ></Route>
                      <Route path="/reports" element={<Result />}></Route>
                      <Route
                        path="/settings"
                        element={<ChangePasswordPage />}
                      ></Route>
                      <Route
                        path="/profile"
                        element={<StudentProfile />}
                      ></Route>
                      <Route
                        path="/gallery/approved"
                        element={<UploadPage />}
                      ></Route>
                      <Route
                        path="/gallery/pending"
                        element={<PendingPage />}
                      ></Route>
                      <Route
                        path="/gallery/rejected"
                        element={<RejectedPage />}
                      ></Route>
                      <Route path="*" element={<Navigate to="/" />}></Route>
                    </Routes>
                  </div>
                </>
              }
            />
          }
        ></Route>
      </Routes>
    </>
  );
}

export default App;
