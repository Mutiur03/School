import { useRef, useState, useEffect, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import { Toaster } from 'react-hot-toast';
import RoleRoute from './components/RoleRoute.tsx';
import { RegistrationPdfPreview } from '@school/common-ui';

function ClassPdfPreviewPage({ classSlug }: { classSlug: 'class-6' | 'class-8' | 'class-9' }) {
  const { id } = useParams();
  if (!id) return <Navigate to="/" replace />;
  return <RegistrationPdfPreview classSlug={classSlug} id={id} mode="live" />;
}

import { useAuth } from './context/useAuth.tsx';
import envPreferredRole from './lib/role.ts';
import { SentryRoutes } from './lib/sentry.ts';
import Loading from './components/Loading.tsx';
import TopLoadingBar from './components/TopLoadingBar.tsx';
import ServerOffline from './pages/Common/ServerOffline.tsx';
import Login from './pages/Common/Login.tsx';
import NotFound from './pages/Common/not-found.tsx';
import { lazyWithReload as lazy } from './lib/lazyWithReload.ts';
import { registerRoutePrefetchers } from './lib/routePrefetch.ts';

// Route pages — lazy to keep initial shell small
const TeacherDashboard = lazy(() => import('./pages/Teachers/TeacherDashboard'));
const TeacherSettings = lazy(() => import('./pages/Teachers/TeacherSettings'));
const StudentDashboard = lazy(() => import('./pages/Students/StudentDashboard'));
const StudentProfile = lazy(() => import('./pages/Students/StudentProfile'));
const Result = lazy(() => import('./pages/Students/Result'));
const Dashboard = lazy(() => import('./pages/Admin/Dashboard'));
const ViewMarks = lazy(() => import('./pages/Admin/ViewMarks'));
const StudentList = lazy(() => import('./pages/Admin/StudentList'));
const AlumniList = lazy(() => import('./pages/Admin/AlumniList'));
const TeacherList = lazy(() => import('./pages/Admin/TeacherList'));
const StaffList = lazy(() => import('./pages/Admin/StaffList'));
const Head = lazy(() => import('./pages/Admin/Head'));
const CitizenCharter = lazy(() => import('./pages/Admin/CitizenCharter'));
const GenerateResult = lazy(() => import('./pages/Admin/GenerateResult'));
const ShowMarkSheet = lazy(() => import('./pages/Admin/ShowMarkSheet'));
const ExamPDFRoutine = lazy(() => import('./pages/Admin/ExamPDFRoutine'));
const AddMarks = lazy(() => import('./pages/Admin/AddMarks'));
const NewSubject = lazy(() => import('./pages/Admin/NewSubject'));
const AddLevel = lazy(() => import('./pages/Admin/AddLevel'));
const UpdateStatus = lazy(() => import('./pages/Admin/UpdateStatus'));
const Attendence = lazy(() => import('./pages/Admin/Attendence'));
const StayCheck = lazy(() => import('./pages/Admin/StayCheck'));
const SmsManagement = lazy(() => import('./pages/Admin/SmsManagement'));
const Notice = lazy(() => import('./pages/Admin/Notice'));
const Holidays = lazy(() => import('./pages/Admin/Holidays'));
const Admission = lazy(() => import('./pages/Admin/Admission'));
const AdmissionSettings = lazy(() => import('./pages/Admin/AdmissionSettings'));
const AdmissionResult = lazy(() => import('./pages/Admin/AdmissionResult'));
const Syllabus = lazy(() => import('./pages/Admin/Syllabus'));
const ClassRoutinePDF = lazy(() => import('./pages/Admin/ClassRoutinePDF'));
const Events = lazy(() => import('./pages/Admin/Events'));
const Gallery = lazy(() => import('./pages/Admin/Gallery'));
const GalleryModeration = lazy(() => import('./pages/Admin/GalleryModeration'));
const ClassRegForm = lazy(() => import('./pages/Admin/ClassRegForm'));
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdmin/Dashboard'));
const SchoolManagement = lazy(() => import('./pages/SuperAdmin/SchoolManagement'));
const ExamTypes = lazy(() => import('./pages/SuperAdmin/ExamTypes'));
const SmsOverview = lazy(() => import('./pages/SuperAdmin/SmsOverview'));

/** Sidebar hover warms these chunks. Add/remove paths here anytime. */
registerRoutePrefetchers({
  '/admin/dashboard': Dashboard,
  '/admin/students/student-list': StudentList,
  '/admin/students/alumni-list': AlumniList,
  '/admin/administration/teacher-list': TeacherList,
  '/admin/administration/staff-list': StaffList,
  '/admin/administration/head': Head,
  '/admin/result/add-subject': NewSubject,
  '/admin/result/assigned-teachers': AddLevel,
  '/admin/result/add-marks': AddMarks,
  '/admin/result/view-marks': ViewMarks,
  '/admin/result/generate-result': GenerateResult,
  '/admin/result/customize-result': UpdateStatus,
  '/admin/registration/class-6': ClassRegForm,
  '/admin/registration/class-8': ClassRegForm,
  '/admin/registration/class-9': ClassRegForm,
  '/admin/admission/form': Admission,
  '/admin/admission/settings': AdmissionSettings,
  '/admin/admission/result': AdmissionResult,
  '/admin/settings/add-exam': ExamPDFRoutine,
  '/admin/syllabus': Syllabus,
  '/admin/classRoutine': ClassRoutinePDF,
  '/admin/citizencharter': CitizenCharter,
  '/admin/attendance': Attendence,
  '/admin/attendance-double': StayCheck,
  '/admin/sms-management': SmsManagement,
  '/admin/notice': Notice,
  '/admin/holiday': Holidays,
  '/admin/events': Events,
  '/admin/gallery/upload': Gallery,
  '/admin/gallery/pending': GalleryModeration,
  '/admin/gallery/rejected': GalleryModeration,
  '/teacher/dashboard': TeacherDashboard,
  '/teacher/settings': TeacherSettings,
  '/teacher/students': StudentList,
  '/teacher/mark-management': AddMarks,
  '/teacher/result/view-marks': ViewMarks,
  '/teacher/attendance': Attendence,
  '/teacher/attendance-double': StayCheck,
  '/student/dashboard': StudentDashboard,
  '/student/profile': StudentProfile,
  '/student/result': Result,
  '/super_admin/dashboard': SuperAdminDashboard,
  '/super_admin/settings/school': SchoolManagement,
  '/super_admin/settings/exams': ExamTypes,
  '/super_admin/settings/sms': SmsOverview,
});

function App() {
  const [sidebarExpanded, setSidebarExpanded] = useState(window.innerWidth >= 768);
  const { user, loading, serverOffline } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navbarRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const preferredRolePath = envPreferredRole === 'super_admin' ? 'super_admin' : envPreferredRole;
  const currentUserDashboardPath =
    user?.role === 'super_admin'
      ? '/super_admin/dashboard'
      : user
        ? `/${user.role}/dashboard`
        : '/';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSidebarExpanded(window.innerWidth >= 768);
    }
  }, []);

  useEffect(() => {
    if (location.pathname.includes('/login')) return;

    if (user?.role) {
      switch (user.role) {
        case 'admin':
          document.title = 'Admin Panel';
          break;
        case 'super_admin':
          document.title = 'Super Admin Panel';
          break;
        case 'teacher':
          document.title = "Teacher's Dashboard";
          break;
        case 'student':
          document.title = "Student's Dashboard";
          break;
        default:
          document.title = 'Panchbibi Lal Bihari Pilot Govt. High School';
      }
    } else {
      document.title = 'Panchbibi Lal Bihari Pilot Govt. High School';
    }
  }, [user?.role, location.pathname]);

  if (loading) {
    return (
      <div className="bg-background flex h-screen items-center justify-center">
        <Loading />
      </div>
    );
  }

  const contentShellClass = [
    'content-area relative min-h-0 min-w-0 flex-1 overflow-x-clip overflow-y-auto',
    'pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-[margin,width] duration-200',
    sidebarExpanded ? 'md:ml-[250px] md:w-[calc(100%-250px)]' : 'md:ml-16 md:w-[calc(100%-4rem)]',
  ].join(' ');

  return (
    <>
      <Toaster
        position="top-right"
        reverseOrder={false}
        toastOptions={{ style: { marginTop: '50px' } }}
      />
      <div className="flex h-screen flex-col">
        <Suspense
          fallback={
            <>
              <TopLoadingBar />
              <div className="bg-background flex h-screen items-center justify-center">
                <Loading />
              </div>
            </>
          }
        >
          <SentryRoutes>
            <Route
              path="/preview/class6/:id"
              element={<ClassPdfPreviewPage classSlug="class-6" />}
            />
            <Route
              path="/preview/class8/:id"
              element={<ClassPdfPreviewPage classSlug="class-8" />}
            />
            <Route
              path="/preview/class9/:id"
              element={<ClassPdfPreviewPage classSlug="class-9" />}
            />

            {/* CASE 1: envPreferredRole IS PRESENT */}
            {envPreferredRole && (
              <>
                <Route path={`/${preferredRolePath}/login`} element={<Login />} />
                {!user && (
                  <Route
                    path="*"
                    element={
                      serverOffline ? (
                        <ServerOffline />
                      ) : (
                        <Navigate
                          to={`/${preferredRolePath}/login`}
                          state={{ from: location.pathname }}
                          replace
                        />
                      )
                    }
                  />
                )}
                {user && (
                  <Route
                    path="*"
                    element={
                      <Navigate
                        to={
                          user.role === envPreferredRole
                            ? currentUserDashboardPath
                            : `/${preferredRolePath}/login`
                        }
                        replace
                      />
                    }
                  />
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
                    <Route
                      path="/admin/*"
                      element={
                        serverOffline ? (
                          <ServerOffline />
                        ) : (
                          <Navigate to="/admin/login" state={{ from: location.pathname }} replace />
                        )
                      }
                    />
                    <Route
                      path="/teacher/*"
                      element={
                        serverOffline ? (
                          <ServerOffline />
                        ) : (
                          <Navigate
                            to="/teacher/login"
                            state={{ from: location.pathname }}
                            replace
                          />
                        )
                      }
                    />
                    <Route
                      path="/student/*"
                      element={
                        serverOffline ? (
                          <ServerOffline />
                        ) : (
                          <Navigate
                            to="/student/login"
                            state={{ from: location.pathname }}
                            replace
                          />
                        )
                      }
                    />
                    <Route path="*" element={<NotFound />} />
                  </>
                )}
                {user && (
                  <Route
                    path="*"
                    element={
                      <Navigate
                        to={
                          user.role === 'super_admin'
                            ? '/super_admin/dashboard'
                            : `/${user.role}/dashboard`
                        }
                        replace
                      />
                    }
                  />
                )}
              </>
            )}

            {/* ROLE SPECIFIC PROTECTED ROUTES */}

            {/* Teacher Routes */}
            {user?.role === 'teacher' && (!envPreferredRole || envPreferredRole === 'teacher') && (
              <Route
                path="/teacher/*"
                element={
                  <RoleRoute
                    role="teacher"
                    element={
                      <div className="flex min-h-0 flex-1 flex-col">
                        <Navbar
                          ref={navbarRef}
                          onBurgerClick={() => setSidebarOpen((prev) => !prev)}
                          sidebarOpen={sidebarOpen}
                        />
                        <Sidebar
                          sidebarExpanded={sidebarExpanded}
                          setSidebarExpanded={setSidebarExpanded}
                          open={sidebarOpen}
                          onClose={() => setSidebarOpen(false)}
                          navbarRef={navbarRef}
                        />
                        <div className={contentShellClass}>
                          <Routes>
                            <Route path="/dashboard" element={<TeacherDashboard />} />
                            <Route path="/settings" element={<TeacherSettings />} />
                            <Route path="/students" element={<StudentList readOnly />} />
                            <Route path="/mark-management" element={<AddMarks />} />
                            <Route path="/result/view-marks" element={<ViewMarks />} />
                            <Route path="/attendance" element={<Attendence />} />
                            <Route path="/attendance-double" element={<StayCheck />} />
                            <Route path="*" element={<Navigate to="/teacher/dashboard" />} />
                          </Routes>
                        </div>
                      </div>
                    }
                  />
                }
              />
            )}

            {/* Student Routes */}
            {user?.role === 'student' && (!envPreferredRole || envPreferredRole === 'student') && (
              <Route
                path="/student/*"
                element={
                  <RoleRoute
                    role="student"
                    element={
                      <div className="flex min-h-0 flex-1 flex-col">
                        <Navbar
                          ref={navbarRef}
                          onBurgerClick={() => setSidebarOpen((prev) => !prev)}
                          sidebarOpen={sidebarOpen}
                        />
                        <Sidebar
                          sidebarExpanded={sidebarExpanded}
                          setSidebarExpanded={setSidebarExpanded}
                          open={sidebarOpen}
                          onClose={() => setSidebarOpen(false)}
                          navbarRef={navbarRef}
                        />
                        <div className={contentShellClass}>
                          <Routes>
                            <Route path="/dashboard" element={<StudentDashboard />} />
                            <Route path="/profile" element={<StudentProfile />} />
                            <Route path="/result" element={<Result />} />
                            <Route path="*" element={<Navigate to="/student/dashboard" />} />
                          </Routes>
                        </div>
                      </div>
                    }
                  />
                }
              />
            )}

            {/* Admin Routes */}
            {user?.role === 'admin' && (!envPreferredRole || envPreferredRole === 'admin') && (
              <Route
                path="/admin/*"
                element={
                  <RoleRoute
                    role="admin"
                    element={
                      <div className="flex min-h-0 flex-1 flex-col">
                        <Navbar
                          ref={navbarRef}
                          onBurgerClick={() => setSidebarOpen((prev) => !prev)}
                          sidebarOpen={sidebarOpen}
                        />
                        <Sidebar
                          sidebarExpanded={sidebarExpanded}
                          setSidebarExpanded={setSidebarExpanded}
                          open={sidebarOpen}
                          onClose={() => setSidebarOpen(false)}
                          navbarRef={navbarRef}
                        />
                        <div className={contentShellClass}>
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
                            <Route
                              path="/finalmarkSheet/:studentId/:year"
                              element={<ShowMarkSheet />}
                            />
                            <Route path="/settings/add-exam" element={<ExamPDFRoutine />} />
                            <Route path="/result/add-marks" element={<AddMarks />} />
                            <Route path="/result/add-subject" element={<NewSubject />} />
                            <Route path="/result/assigned-teachers" element={<AddLevel />} />
                            <Route path="/result/customize-result" element={<UpdateStatus />} />
                            <Route path="/attendance" element={<Attendence />} />
                            <Route path="/attendance-double" element={<StayCheck />} />
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
                            <Route
                              path="/gallery/pending"
                              element={<GalleryModeration mode="pending" />}
                            />
                            <Route
                              path="/gallery/rejected"
                              element={<GalleryModeration mode="rejected" />}
                            />
                            <Route
                              path="/registration/class-9"
                              element={<ClassRegForm key="class-9" variant={9} />}
                            />
                            <Route
                              path="/registration/class-6"
                              element={<ClassRegForm key="class-6" variant={6} />}
                            />
                            <Route
                              path="/registration/class-8"
                              element={<ClassRegForm key="class-8" variant={8} />}
                            />
                            <Route path="*" element={<Navigate to="/admin/dashboard" />} />
                          </Routes>
                        </div>
                      </div>
                    }
                  />
                }
              />
            )}

            {/* Super Admin Routes */}
            {user?.role === 'super_admin' && envPreferredRole === 'super_admin' && (
              <Route
                path="/super_admin/*"
                element={
                  <RoleRoute
                    role="super_admin"
                    element={
                      <div className="flex min-h-0 flex-1 flex-col">
                        <Navbar
                          ref={navbarRef}
                          onBurgerClick={() => setSidebarOpen((prev) => !prev)}
                          sidebarOpen={sidebarOpen}
                        />
                        <Sidebar
                          sidebarExpanded={sidebarExpanded}
                          setSidebarExpanded={setSidebarExpanded}
                          open={sidebarOpen}
                          onClose={() => setSidebarOpen(false)}
                          navbarRef={navbarRef}
                        />
                        <div className={contentShellClass}>
                          <Routes>
                            <Route path="/dashboard" element={<SuperAdminDashboard />} />
                            <Route path="/settings/school" element={<SchoolManagement />} />
                            <Route path="/settings/exams" element={<ExamTypes />} />
                            <Route path="/settings/sms" element={<SmsOverview />} />
                            <Route path="*" element={<Navigate to="/super_admin/dashboard" />} />
                          </Routes>
                        </div>
                      </div>
                    }
                  />
                }
              />
            )}
          </SentryRoutes>
        </Suspense>
      </div>
    </>
  );
}

export default App;
