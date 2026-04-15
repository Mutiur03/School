import { Toaster } from "react-hot-toast";
import { Navigate, Route, Routes } from "react-router-dom";
import axios from "axios";

import {
  Admission,
  AdmissionForm,
  AdmissionFormNew,
  AdmissionFormNotice,
  AdmissionResult,
  AdmissionResultList,
  AppLayout,
  AtAGlance,
  ConfirmationAdmission,
  ConfirmationClass6,
  ConfirmationClass8,
  ConfirmationClass9,
  Event,
  ExamRoutinePage,
  Gallery,
  HeadMsg,
  Home,
  Images,
  Notice,
  RegClass6,
  RegClass8,
  RegClass9,
  RegistrationClass9,
  RegistrationClass6,
  RegistrationClass8,
  StaffList,
  TeacherList,
} from "@school/client-ui";
import { Class6PdfPreview, Class8PdfPreview, Class9PdfPreview } from "@school/common-ui";

function App() {
  const backendBaseUrl = String(import.meta.env.VITE_BACKEND_URL ?? "").trim();
  axios.defaults.baseURL = backendBaseUrl;

  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { marginTop: "50px" } }} />

      <Routes>
        {/* <Route path="/pdf/submission/*" element={<PDF />} /> */}

        <Route
          path="/preview/class6/:id"
          element={<Class6PdfPreview />}
        />

        <Route
          path="/preview/class8/:id"
          element={<Class8PdfPreview />}
        />

        <Route
          path="/preview/class9/:id"
          element={<Class9PdfPreview />}
        />

        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/notices" element={<Notice />} />
          <Route path="/events" element={<Event />} />
          <Route path="/message-from-head" element={<HeadMsg />} />
          <Route path="/teacher-list" element={<TeacherList />} />
          <Route path="/staff-list" element={<StaffList />} />
          <Route path="/exam-routine" element={<ExamRoutinePage />} />
          <Route path="/at-a-glance" element={<AtAGlance />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/gallery/:type/:id" element={<Images />} />
          <Route path="/registration/class-9" element={<RegClass9 />} />
          <Route path="/registration/class-9/form" element={<RegistrationClass9 />} />
          <Route path="/registration/class-9/form/:id" element={<RegistrationClass9 />} />
          <Route path="/registration/class-9/confirm/:id" element={<ConfirmationClass9 />} />
          <Route path="/registration/class-6" element={<RegClass6 />} />
          <Route path="/registration/class-6/form" element={<RegistrationClass6 />} />
          <Route path="/registration/class-6/form/:id" element={<RegistrationClass6 />} />
          <Route path="/registration/class-6/confirm/:id" element={<ConfirmationClass6 />} />
          <Route path="/registration/class-8" element={<RegClass8 />} />
          <Route path="/registration/class-8/form" element={<RegistrationClass8 />} />
          <Route path="/registration/class-8/form/:id" element={<RegistrationClass8 />} />
          <Route path="/registration/class-8/confirm/:id" element={<ConfirmationClass8 />} />
          <Route path="/admission/notice" element={<Admission />} />
          <Route path="/admission" element={<AdmissionFormNotice />} />
          <Route path="/admission/form" element={<AdmissionFormNew />} />
          <Route path="/admission/form/:id" element={<AdmissionFormNew />} />
          <Route path="/admission/test" element={<AdmissionForm />} />
          <Route path="/admission/test/:id" element={<AdmissionForm />} />

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
