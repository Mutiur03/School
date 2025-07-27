import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import AboutGlance from "./pages/AboutGlance";
import AboutHistory from "./pages/AboutHistory";
import AdminTeacher from "./pages/AdminTeacher";
import AdminStaff from "./pages/AdminStaff";
import Gallery from "./pages/Gallery";
import NoticePage from "./pages/Notice";
import IndivisulNotice from "./pages/IndivisualNotice";
import ClassRoutinePage from "./pages/ClassRoutine";
import ExamRoutinePage from "./pages/ExamRoutine";
import SyllabusPage from "./pages/Syllabus";
import ScrollToTop from "./components/ScrollToTop";
import Event from "./pages/Event";
import axios from "axios";
import CategoryGallery from "./pages/CategoryGallery";
import Images from "./pages/Images";
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import EventDetail from "./pages/EventDetail";


function App() {
  axios.defaults.baseURL = import.meta.env.VITE_BACKEND_URL;

  return (
    <>
      <Navbar />
      <ScrollToTop />
      <div className="min-h-[80vh] text-center">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about/glance" element={<AboutGlance />}></Route>
          <Route path="/about/history" element={<AboutHistory />}></Route>
          <Route path="/administration/teacher" element={<AdminTeacher />}></Route>
          <Route path="/administration/staff" element={<AdminStaff />}></Route>
          <Route path="/gallery/events" element={<Gallery />}></Route>
          <Route path="/gallery/campus" element={<CategoryGallery />}></Route>
          <Route path="/gallery/campus/:id" element={<Images type={"campus"} />}></Route>
          <Route path="/gallery/events/:id" element={<Images type={"events"} />}></Route>
          <Route path="/notice" element={<NoticePage />}></Route>
          <Route path="/events" element={<Event />}></Route>
          <Route path="/notice/:id" element={<IndivisulNotice />}></Route>
          <Route path="/event/:id" element={<EventDetail />}></Route>
          <Route path="/syllabus" element={<SyllabusPage />}></Route>
          <Route path="/routine/class" element={<ClassRoutinePage />}></Route>
          <Route path="/routine/exam" element={<ExamRoutinePage />}></Route>

          <Route path="*" element={<Navigate to="/" />}></Route>
        </Routes>
      </div>
      <Footer />
    </>
  )
}

export default App
