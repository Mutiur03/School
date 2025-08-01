import React, { useRef, useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import { Toaster } from "react-hot-toast";
import PrivateRoute from "./components/PrivateRoute.jsx";
import axios from "axios";
import {
  Login,
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
  AddExam,
  Settings,
  AlumniList,
} from "./pages";
import Syllabus from "./pages/Syllabus";
import ClassRoutine from "./pages/ClassRoutine";
function App() {
  const [sidebarExpanded, setSidebarExpanded] = useState(
    window.innerWidth >= 768
  );

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navbarRef = useRef(null);
  axios.defaults.baseURL = import.meta.env.VITE_BACKEND_URL;
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
            <Route path="/login" element={<Login />} />

            <Route
              path="*"
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
                              path="/teachers/list"
                              element={<TeacherList />}
                            />
                            <Route
                              path="/classes"
                              element={<div>Classes</div>}
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
                              element={<AddExam />}
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
                              path="/teachers/assigned-teachers"
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
                            <Route path="/notice" element={<Notice />} />
                            <Route
                              path="/holiday"
                              element={<Holidays />}
                            ></Route>
                            <Route
                              path="/syllabus"
                              element={<Syllabus />}
                            ></Route>
                            <Route
                              path="/classRoutine"
                              element={<ClassRoutine />}
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
                              path="*"
                              element={<Navigate to="/dashboard" />}
                            />
                            {/* </Route> */}
                          </Routes>
                        </div>
                      </div>
                    </div>
                  }
                />
              }
            />
          </Routes>
        </div>
      </div>
    </>
  );
}

export default App;
