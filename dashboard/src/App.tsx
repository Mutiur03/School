import { useRef, useState, useEffect, Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import { Toaster } from "react-hot-toast";
import PrivateRoute from "./components/PrivateRoute.tsx";
import TeacherRoute from "./components/TeacherRoute.tsx";
import StudentRoute from "./components/StudentRoute.tsx";
import axios from "axios";
import { Class6PdfPreview, Class8PdfPreview } from "@school/common-ui";

import backend from "./lib/backend.ts";
import { useAuth } from "./context/useAuth.tsx";
import envPreferredRole from "./lib/role.ts";
import Loading from "./components/Loading.tsx";
import TopLoadingBar from "./components/TopLoadingBar.tsx";
import ServerOffline from "./pages/Common/ServerOffline.tsx";
import Login from "./pages/Common/Login.tsx";
import NotFound from "./pages/Common/not-found.tsx";

// --- Lazy-loaded Components ---

// Admin Pages
const AddMarks = lazy(() => import("./pages/Admin/AddMarks"));
const NewSubject = lazy(() => import("./pages/Admin/NewSubject"));
const AddLevel = lazy(() => import("./pages/Admin/AddLevel"));
const Dashboard = lazy(() => import("./pages/Admin/Dashboard"));
const UpdateStatus = lazy(() => import("./pages/Admin/UpdateStatus"));
const Attendence = lazy(() => import("./pages/Admin/Attendence"));
const Notice = lazy(() => import("./pages/Admin/Notice"));
const Holidays = lazy(() => import("./pages/Admin/Holidays"));
const Events = lazy(() => import("./pages/Admin/Events"));
const Gallery = lazy(() => import("./pages/Admin/Gallery"));
const PendingImages = lazy(() => import("./pages/Admin/PendingImages"));
const RejectedImages = lazy(() => import("./pages/Admin/RejectedImages"));
const TeacherList = lazy(() => import("./pages/Admin/TeacherList"));
const StudentList = lazy(() => import("./pages/Admin/StudentList"));
const ShowMarkSheet = lazy(() => import("./pages/Admin/ShowMarkSheet"));
const GenerateResult = lazy(() => import("./pages/Admin/GenerateResult"));
const ViewMarks = lazy(() => import("./pages/Admin/ViewMarks"));
const AlumniList = lazy(() => import("./pages/Admin/AlumniList"));
const SmsManagement = lazy(() => import("./pages/Admin/SmsManagement"));
const Head = lazy(() => import("./pages/Admin/Head"));
const StaffList = lazy(() => import("./pages/Admin/StaffList"));
const CitizenCharter = lazy(() => import("./pages/Admin/CitizenCharter"));
const ExamPDFRoutine = lazy(() => import("./pages/Admin/ExamPDFRoutine"));
const Admission = lazy(() => import("./pages/Admin/Admission"));
const AdmissionSettings = lazy(() => import("./pages/Admin/AdmissionSettings"));
const AdmissionResult = lazy(() => import("./pages/Admin/AdmissionResult"));
const Syllabus = lazy(() => import("./pages/Admin/Syllabus"));
const ClassRoutinePDF = lazy(() => import("./pages/Admin/ClassRoutinePDF"));
const SSCRegForm = lazy(() => import("./pages/Admin/SSCRegForm"));
const Class6RegForm = lazy(() => import("./pages/Admin/Class6RegForm"));
const Class8RegForm = lazy(() => import("./pages/Admin/Class8RegForm"));

// Teacher Pages
const TeacherDashboard = lazy(() => import("./pages/Teachers/TeacherDashboard.tsx"));
const TeacherSettings = lazy(() => import("./pages/Teachers/index.ts").then(m => ({ default: m.TeacherSettings })));

// Student Pages
const StudentDashboard = lazy(() => import("./pages/Students/StudentDashboard.tsx"));
const Result = lazy(() => import("./pages/Students/Result.tsx"));

function App() {
  const [sidebarExpanded, setSidebarExpanded] = useState(window.innerWidth >= 768);
  const { user, loading, serverOffline } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navbarRef = useRef<HTMLElement>(null);
  const location = useLocation();
  axios.defaults.baseURL = backend;

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSidebarExpanded(window.innerWidth >= 768);
    }
  }, []);

  useEffect(() => {
    if (location.pathname.includes('/login')) return;

    if (user?.role) {
      switch (user.role) {
        case 'admin': document.title = 'Admin Panel'; break;
        case 'teacher': document.title = "Teacher's Dashboard"; break;
        case 'student': document.title = "Student's Dashboard"; break;
        default: document.title = 'Panchbibi Lal Bihari Pilot Govt. High School';
      }
    } else {
      document.title = 'Panchbibi Lal Bihari Pilot Govt. High School';
    }
  }, [user?.role, location.pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loading />
      </div>
    );
  }

  return (
    <>
      <Toaster
        position="top-right"
        reverseOrder={false}
        toastOptions={{ style: { marginTop: "50px" } }}
      />
      <div className="flex flex-col h-screen">
        <Suspense fallback={<><TopLoadingBar /><div className="flex items-center justify-center h-screen bg-background"><Loading /></div></>}>
          <Routes>
            <Route path="/preview/class6/:id" element={<Class6PdfPreview />} />
            <Route path="/preview/class8/:id" element={<Class8PdfPreview />} />

            {/* CASE 1: envPreferredRole IS PRESENT */}
            {envPreferredRole && (
              <>
                <Route path={`/${envPreferredRole}/login`} element={<Login />} />
                {!user && (
                  <Route path="*" element={serverOffline ? <ServerOffline /> : <Navigate to={`/${envPreferredRole}/login`} state={{ from: location.pathname }} replace />} />
                )}
                {user && (
                  <Route path="*" element={<Navigate to={user.role === envPreferredRole ? `/${envPreferredRole}/dashboard` : `/${envPreferredRole}/login`} replace />} />
                )}
              </>
            )}

            {/* CASE 2: envPreferredRole IS NOT PRESENT */}
            {!envPreferredRole && (
              <>
                <Route path="/admin/login" element={<Login />} />
                <Route path="/teacher/login" element={<Login />} />
                <Route path="/student/login" element={<Login />} />
                {!user && (
                  <>
                    <Route path="/admin/*" element={serverOffline ? <ServerOffline /> : <Navigate to="/admin/login" state={{ from: location.pathname }} replace />} />
                    <Route path="/teacher/*" element={serverOffline ? <ServerOffline /> : <Navigate to="/teacher/login" state={{ from: location.pathname }} replace />} />
                    <Route path="/student/*" element={serverOffline ? <ServerOffline /> : <Navigate to="/student/login" state={{ from: location.pathname }} replace />} />
                    <Route path="*" element={<NotFound />} />
                  </>
                )}
                {user && (
                  <Route path="*" element={<Navigate to={`/${user.role}/dashboard`} replace />} />
                )}
              </>
            )}

            {/* ROLE SPECIFIC PROTECTED ROUTES */}

            {/* Teacher Routes */}
            {user?.role === "teacher" && (!envPreferredRole || envPreferredRole === 'teacher') && (
              <Route path="/teacher/*" element={
                <TeacherRoute element={
                  <div className="flex flex-col">
                    <Navbar ref={navbarRef} onBurgerClick={() => setSidebarOpen((prev) => !prev)} />
                    <Sidebar sidebarExpanded={sidebarExpanded} setSidebarExpanded={setSidebarExpanded} open={sidebarOpen} onClose={() => setSidebarOpen(false)} navbarRef={navbarRef} />
                    <div className="content-area flex-1 overflow-y-auto relative px-4 transition-all duration-100 md:ml-60 md:w-[calc(100%-15rem)]">
                      <Routes>
                        <Route path="/dashboard" element={<TeacherDashboard />} />
                        <Route path="/settings" element={<TeacherSettings />} />
                        <Route path="/mark-management" element={<AddMarks />} />
                        <Route path="/attendance" element={<Attendence />} />
                        <Route path="*" element={<Navigate to="/teacher/dashboard" />} />
                      </Routes>
                    </div>
                  </div>
                } />
              } />
            )}

            {/* Student Routes */}
            {user?.role === "student" && (!envPreferredRole || envPreferredRole === 'student') && (
              <Route path="/student/*" element={
                <StudentRoute element={
                  <div className="flex flex-col">
                    <Navbar ref={navbarRef} onBurgerClick={() => setSidebarOpen((prev) => !prev)} />
                    <Sidebar sidebarExpanded={sidebarExpanded} setSidebarExpanded={setSidebarExpanded} open={sidebarOpen} onClose={() => setSidebarOpen(false)} navbarRef={navbarRef} />
                    <div className="content-area flex-1 overflow-y-auto relative px-4 transition-all duration-100 md:ml-60 md:w-[calc(100%-15rem)]">
                      <Routes>
                        <Route path="/dashboard" element={<StudentDashboard />} />
                        <Route path="/result" element={<Result />} />
                        <Route path="*" element={<Navigate to="/student/dashboard" />} />
                      </Routes>
                    </div>
                  </div>
                } />
              } />
            )}

            {/* Admin Routes */}
            {user?.role === "admin" && (!envPreferredRole || envPreferredRole === 'admin') && (
              <Route path="/admin/*" element={
                <PrivateRoute element={
                  <div className="flex flex-col">
                    <Navbar ref={navbarRef} onBurgerClick={() => setSidebarOpen((prev) => !prev)} />
                    <Sidebar sidebarExpanded={sidebarExpanded} setSidebarExpanded={setSidebarExpanded} open={sidebarOpen} onClose={() => setSidebarOpen(false)} navbarRef={navbarRef} />
                    <div className="content-area flex-1 overflow-y-auto relative px-4 transition-all duration-100 md:ml-60 md:w-[calc(100%-15rem)]">
                      <Routes>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/result/view-marks" element={<ViewMarks />} />
                        <Route path="/students/student-list" element={<StudentList />} />
                        <Route path="/students/alumni-list" element={<AlumniList />} />
                        <Route path="/administration/teacher-list" element={<TeacherList />} />
                        <Route path="/administration/staff-list" element={<StaffList />} />
                        <Route path="/administration/head" element={<Head />} />
                        <Route path="/citizencharter" element={<CitizenCharter />} />
                        <Route path="/result/generate-result" element={<GenerateResult />} />
                        <Route path="/finalmarkSheet/:studentId/:year" element={<ShowMarkSheet />} />
                        <Route path="/settings/add-exam" element={<ExamPDFRoutine />} />
                        <Route path="/result/add-marks" element={<AddMarks />} />
                        <Route path="/result/add-subject" element={<NewSubject />} />
                        <Route path="/result/assigned-teachers" element={<AddLevel />} />
                        <Route path="/result/customize-result" element={<UpdateStatus />} />
                        <Route path="/attendance" element={<Attendence />} />
                        <Route path="/sms-management" element={<SmsManagement />} />
                        <Route path="/notice" element={<Notice />} />
                        <Route path="/holiday" element={<Holidays />} />
                        <Route path="/admission/form" element={<Admission />} />
                        <Route path="/admission/settings" element={<AdmissionSettings />} />
                        <Route path="/admission/result" element={<AdmissionResult />} />
                        <Route path="/syllabus" element={<Syllabus />} />
                        <Route path="/classRoutine" element={<ClassRoutinePDF />} />
                        <Route path="/events" element={<Events />} />
                        <Route path="/gallery/upload" element={<Gallery />} />
                        <Route path="/gallery/pending" element={<PendingImages />} />
                        <Route path="/gallery/rejected" element={<RejectedImages />} />
                        <Route path="/registration/ssc" element={<SSCRegForm />} />
                        <Route path="/registration/class-6" element={<Class6RegForm />} />
                        <Route path="/registration/class-8" element={<Class8RegForm />} />
                        <Route path="*" element={<Navigate to="/admin/dashboard" />} />
                      </Routes>
                    </div>
                  </div>
                } />
              } />
            )}
          </Routes>
        </Suspense>
      </div>
    </>
  );
}

export default App;
