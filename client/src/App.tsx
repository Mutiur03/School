import { Toaster } from "react-hot-toast"
import { Navigate, Route, Routes, useLocation } from "react-router-dom"
import Home from "./pages/Home"
import axios from "axios"
import Header from "./components/Header";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import RightSidebar from "./components/RightSidebar";
import Notice from "./pages/Notice";
import HeadMsg from "./pages/HeadMsg";
import TeacherList from "./pages/TeacherList";
import StaffList from "./pages/StaffList";
import ExamRoutinePage from "./pages/ExamRoutine";
import Event from "./pages/Event";
import At_a_glance from "./pages/At_a_glance";
import Gallery from "./pages/Gallery";
import Images from "./pages/Images";
import Registration from "./pages/Registration";
import ConfirmationReg from "./pages/ConfirmationReg";
import RegSSC from "./pages/RegSSC";

function App() {
  axios.defaults.baseURL = import.meta.env.VITE_BACKEND_URL;

  const location = useLocation();

  const routesWithoutSidebar = ['/registration/ssc', '/reg/ssc'];
  const shouldHideSidebar = routesWithoutSidebar.some(route =>
    location.pathname === route || location.pathname.startsWith(route + '/')
  );

  return (
    <>
      <Toaster
        position="top-right"
        reverseOrder={false}
        toastOptions={{ style: { marginTop: "50px" } }}
      />
      <div className="container">
        <Header />
        <Navbar />
        <div className="min-h-screen text-black">
          <hr className="border-t border-gray-300" />
          <br />
          <div className={shouldHideSidebar ? "main-content-full" : "main-content"}>
            <div className="rcontent-pat-1">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/notices" element={<Notice />} />
                <Route path="/events" element={<Event />} />
                <Route path="/message-from-head" element={<HeadMsg />} />
                <Route path="/teacher-list" element={<TeacherList />} />
                <Route path="/staff-list" element={<StaffList />} />
                <Route path="/exam-routine" element={<ExamRoutinePage />} />
                <Route path="/at-a-glance" element={<At_a_glance />} />
                <Route path="/gallery" element={<Gallery />} />
                <Route path="/gallery/:type/:id" element={<Images />} />
                <Route path="/reg/ssc" element={<RegSSC/>} />
                <Route path="/registration/ssc" element={<Registration />} />
                <Route path="/registration/ssc/:id" element={<Registration />} />
                <Route path="/registration/ssc/confirm/:id" element={<ConfirmationReg />} />
                <Route
                  path="*"
                  element={<Navigate to="/" />}
                />
              </Routes>
            </div>
            {!shouldHideSidebar && (
              <div className="content-part-2">
                <div className="secondary-content">
                  <RightSidebar />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}

export default App
