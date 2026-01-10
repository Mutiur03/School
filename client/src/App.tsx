import { Toaster } from "react-hot-toast";
import { Navigate, Route, Routes } from "react-router-dom";
import axios from "axios";


import Home from "./pages/Home";
import Notice from "./pages/Notice";
import Event from "./pages/Event";
import HeadMsg from "./pages/HeadMsg";
import TeacherList from "./pages/TeacherList";
import StaffList from "./pages/StaffList";
import ExamRoutinePage from "./pages/ExamRoutine";
import At_a_glance from "./pages/At_a_glance";
import Gallery from "./pages/Gallery";
import Images from "./pages/Images";
import Registration from "./pages/Registration";
import ConfirmationReg from "./pages/ConfirmationReg";
import RegSSC from "./pages/RegSSC";
import Admission from "./pages/admission";
import AdmissionForm from "./pages/AdmissionForm";
import ConfirmationAdmission from "./pages/ConfirmationAdmission";
import AdmissionResult from "./pages/AdmissionResult";
import AdmissionResultList from "./pages/AdmissionResultList";
import AdmissionFormNotice from "./pages/AdmissionFormNotice";
import MainLayout from "./components/MainLayout";
import AdmissionFormNew from "./pages/AdmissionFormNew";
function App() {
  axios.defaults.baseURL = import.meta.env.VITE_BACKEND_URL;

  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { marginTop: "50px" } }} />

      <Routes>
        {/* <Route path="/pdf/*" element={<PDF />} /> */}

        <Route element={<MainLayout />}>
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
          <Route path="/reg/ssc" element={<RegSSC />} />
          <Route path="/registration/ssc" element={<Registration />} />
          <Route path="/registration/ssc/:id" element={<Registration />} />
          <Route path="/registration/ssc/confirm/:id" element={<ConfirmationReg />} />
          <Route path="/admission/notice" element={<Admission />} />
          <Route path="/admission" element={<AdmissionFormNotice />} />
          <Route path="/admission/form" element={<AdmissionForm />} />
          <Route path="/admission/form/:id" element={<AdmissionForm />} />
          <Route path="/admission/test" element={<AdmissionFormNew />} />
          <Route path="/admission/test/:id" element={<AdmissionFormNew />} />

          <Route path="/admission/form/confirm/:id" element={<ConfirmationAdmission />} />
          <Route path="/admission/results" element={<AdmissionResultList />} />
          <Route path="/admission/result/:classNumber" element={<AdmissionResult />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
}

export default App;
