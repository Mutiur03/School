import { useRef, useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import { Toaster } from "react-hot-toast";
import PrivateRoute from "./components/PrivateRoute.tsx";
import TeacherRoute from "./components/TeacherRoute.tsx";
import StudentRoute from "./components/StudentRoute.tsx";
import axios from "axios";
import {
  AddMarks,
  NewSubject,
  AddLevel,
  Dashboard,
  UpdateStatus,
  Attendence,
  Notice,
  Holidays,
  Events,
  Gallery,
  PendingImages,
  RejectedImages,
  TeacherList,
  StudentList,
  ShowMarkSheet,
  GenerateResult,
  ViewMarks,
  Settings,
  AlumniList,
  SmsManagement,
  Head,
  StaffList,
  CitizenCharter,
  ExamPDFRoutine,
  Admission,
  AdmissionSettings,
  AdmissionResult,
  Syllabus,
  ClassRoutinePDF,
  SSCRegForm,
} from "./pages/Admin/index.ts"

import backend from "./lib/backend.ts";
import StudentDashboard from "./pages/Students/StudentDashboard.tsx";
import TeacherDashboard from "./pages/Teachers/TeacherDashboard.tsx";
import Login from "./pages/Common/Login.tsx";
import { TeacherSettings } from "./pages/Teachers/index.ts";
function App() {
  const [sidebarExpanded, setSidebarExpanded] = useState(
    window.innerWidth >= 768
  );
  const role = import.meta.env.VITE_DEFAULT_ROLE;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navbarRef = useRef<HTMLElement>(null);
  axios.defaults.baseURL = backend;
  useEffect(() => {
    if (typeof window !== "undefined") {
      setSidebarExpanded(window.innerWidth >= 768);
    }
  }, []);
  return (
    <>
      <Toaster
        position="top-right"
        reverseOrder={false}
        toastOptions={{ style: { marginTop: "50px" } }}
      />
      <div className=" flex flex-col h-screen">
        <div className="">
          <Routes>
            {role === "admin" && <Route path="/admin/login" element={<Login />} />}
            {role === "teacher" && <Route path="/teacher/login" element={<Login />} />}
            {role === "student" && <Route path="/student/login" element={<Login />} />}

            {role === "teacher" && (
              <Route
                path="/teacher/*"
                element={
                  <TeacherRoute
                    element={
                      <div className="flex flex-col">
                        <Navbar
                          ref={navbarRef}
                          onBurgerClick={() => {
                            setSidebarOpen((prev) => !prev);
                            console.log("Sidebar open:", !sidebarOpen);
                          }}
                        />
                        <div >
                          <Sidebar
                            sidebarExpanded={sidebarExpanded}
                            setSidebarExpanded={setSidebarExpanded}
                            open={sidebarOpen}
                            onClose={() => setSidebarOpen(false)}
                            navbarRef={navbarRef}
                          />
                          <div
                            className={`content-area flex-1 overflow-y-auto relative px-[1rem] transition-all duration-100 md:ml-[15rem] md:w-[calc(100%-15rem)]}`}
                          >
                            <Routes>
                              <Route path="/dashboard" element={<TeacherDashboard />} />
                              <Route path="/settings" element={<TeacherSettings />} />
                              <Route path="/mark-management" element={<AddMarks />} />
                              <Route path="/attendance" element={<Attendence />} />
                              <Route path="*" element={<Navigate to="/teacher/dashboard" />} />
                            </Routes>
                          </div>
                        </div>
                      </div>
                    }
                  />
                }
              />
            )}

            {role === "student" && (
              <Route
                path="/student/*"
                element={
                  <StudentRoute
                    element={
                      <div className="flex flex-col">
                        <Navbar
                          ref={navbarRef}
                          onBurgerClick={() => {
                            setSidebarOpen((prev) => !prev);
                            console.log("Sidebar open:", !sidebarOpen);
                          }}
                        />
                        <div className="">
                          <Sidebar
                            sidebarExpanded={sidebarExpanded}
                            setSidebarExpanded={setSidebarExpanded}
                            open={sidebarOpen}
                            onClose={() => setSidebarOpen(false)}
                            navbarRef={navbarRef}
                          />
                          <div
                            className={`content-area flex-1 overflow-y-auto relative p-[1rem] transition-all duration-100 md:ml-[15rem] md:w-[calc(100%-15rem)]}`}
                          >
                            <Routes>
                              <Route path="/dashboard" element={<StudentDashboard />} />
                              <Route path="*" element={<Navigate to="/student/dashboard" />} />
                            </Routes>
                          </div>
                        </div>
                      </div>
                    }
                  />
                }
              />
            )}

            {role === "admin" && (
              <Route
                path="/admin/*"
                element={
                  <PrivateRoute
                    element={
                      <div className="flex flex-col">
                        <Navbar
                          ref={navbarRef}
                          onBurgerClick={() => {
                            setSidebarOpen((prev) => !prev);
                            console.log("Sidebar open:", !sidebarOpen);
                          }}
                        />
                        <div className="">
                          <Sidebar
                            sidebarExpanded={sidebarExpanded}
                            setSidebarExpanded={setSidebarExpanded}
                            open={sidebarOpen}
                            onClose={() => setSidebarOpen(false)}
                            navbarRef={navbarRef}
                          />
                          <div
                            className={`content-area flex-1 overflow-y-auto relative p-[1rem]  transition-all duration-100 md:ml-[15rem] md:w-[calc(100%-15rem)]
                          }`}
                          >
                            <Routes>
                              <Route path="/dashboard" element={<Dashboard />} />
                              <Route
                                path="/result/view-marks"
                                element={<ViewMarks />}
                              />
                              <Route path="/settings" element={<Settings />} />
                              <Route
                                path="/students"
                                element={<div>Students</div>}
                              />
                              <Route
                                path="/students/student-list"
                                element={<StudentList />}
                              />
                              <Route
                                path="/students/alumni-list"
                                element={<AlumniList />}
                              />
                              <Route
                                path="/administration/teacher-list"
                                element={<TeacherList />}
                              />
                              <Route
                                path="/administration/staff-list"
                                element={<StaffList />}
                              />
                              <Route
                                path="/administration/head"
                                element={<Head />}
                              />
                              <Route
                                path="/classes"
                                element={<div>Classes</div>}
                              />
                              <Route
                                path="/citizencharter"
                                element={<CitizenCharter />}
                              />
                              <Route
                                path="/result/generate-result"
                                element={<GenerateResult />}
                              />
                              <Route
                                path="/finalmarkSheet/:studentId/:year"
                                element={<ShowMarkSheet />}
                              />

                              <Route
                                path="/settings/add-exam"
                                element={<ExamPDFRoutine />}
                              />
                              <Route
                                path="/result/add-marks"
                                element={<AddMarks />}
                              />
                              <Route
                                path="/settings/add-subject"
                                element={<NewSubject />}
                              />
                              <Route
                                path="/administration/assigned-teachers"
                                element={<AddLevel />}
                              />
                              <Route
                                path="/result/customize-result"
                                element={<UpdateStatus />}
                              />
                              <Route
                                path="/attendance"
                                element={<Attendence />}
                              />
                              <Route
                                path="/sms-management"
                                element={<SmsManagement />}
                              />
                              <Route path="/notice" element={<Notice />} />
                              <Route
                                path="/holiday"
                                element={<Holidays />}
                              ></Route>
                              <Route
                                path="/admission/form"
                                element={<Admission />}
                              ></Route>
                              <Route
                                path="/admission/settings"
                                element={<AdmissionSettings />}
                              ></Route>
                              <Route
                                path="/admission/result"
                                element={<AdmissionResult />}
                              ></Route>
                              <Route
                                path="/syllabus"
                                element={<Syllabus />}
                              ></Route>
                              <Route
                                path="/classRoutine"
                                element={<ClassRoutinePDF />}
                              ></Route>
                              <Route path="/events" element={<Events />}></Route>
                              <Route
                                path="/gallery/upload"
                                element={<Gallery />}
                              ></Route>
                              <Route
                                path="/gallery/pending"
                                element={<PendingImages />}
                              ></Route>
                              <Route
                                path="/gallery/rejected"
                                element={<RejectedImages />}
                              ></Route>
                              <Route
                                path="/registration/ssc"
                                element={<SSCRegForm />}
                              ></Route>
                              <Route
                                path="*"
                                element={<Navigate to="/dashboard" />}
                              />
                            </Routes>
                          </div>
                        </div>
                      </div>
                    }
                  />
                }
              />
            )}
            {role != undefined &&
              <Route path="*" element={<Navigate to={`/${role}/login`} />} />}
            {/* <Route path="*" element={<NotFound />} /> */}
          </Routes>
        </div>
      </div>
    </>
  );
}

export default App;
