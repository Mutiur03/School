import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import NewStudent from "./pages/NewStudent";
import NewTeacher from "./pages/NewTeacher";
import NewSubject from "./pages/NewSubject";
import AddExam from "./pages/AddExam";
import StudentList from "./pages/StudentList";
import AlumniList from "./pages/AlumniList";
import { Toaster } from "react-hot-toast";
import AddMarks from "./pages/AddMarks";
import ViewMarks from "./pages/ViewMarks";
import GenerateResult from "./pages/GenerateResult";
import UpdateStatus from "./pages/UpdateStatus";
import Login from "./pages/Login";
import PrivateRoute from "./components/PrivateRoute.jsx";
import TeacherList from "./pages/TeacherList.jsx";
import AddLevel from "./pages/AddLevel.jsx";
import ShowMarkSheet from "./pages/ShowMarkSheet.jsx";
import Attendence from "./pages/Attendence.jsx";
import axios from "axios";
import Notice from "./pages/Notice.jsx";
import HolidayCalendar from "./pages/Holidays.jsx";
import Events from "./pages/Events.jsx";
import Gallery from "./pages/Gallery.jsx";
import PendingImages from "./pages/PendingImages.jsx";
import RejectedImages from "./pages/RejectedImages.jsx";
function App() {
  const [sidebarExpanded, setSidebarExpanded] = useState(
    window.innerWidth >= 768
  );
  const [openDropdown, setOpenDropdown] = useState(null);

  useEffect(() => {
    const updateSize = () => setSidebarExpanded(window.innerWidth > 768);
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  axios.defaults.baseURL = import.meta.env.VITE_BACKEND_URL;

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
                      <Navbar setOpenDropdown={setOpenDropdown} />
                      <div className="">
                        <Sidebar
                          sidebarExpanded={sidebarExpanded}
                          setSidebarExpanded={setSidebarExpanded}
                          openDropdown={openDropdown}
                          setOpenDropdown={setOpenDropdown}
                        />
                        <div
                          className={`content-area flex-1 overflow-y-auto relative px-[3rem] p-[1rem]  transition-all duration-100 md:ml-[15rem] md:w-[calc(100%-15rem)] ml-[4rem] w-[calc(100%-4rem)]
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
                              path="/attendence"
                              element={<Attendence />}
                            />
                            <Route path="/notice" element={<Notice />} />
                            <Route
                              path="/holiday"
                              element={<HolidayCalendar />}
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
