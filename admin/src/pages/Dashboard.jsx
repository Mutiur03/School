import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

function Dashboard() {
  // State for various dashboard elements
  const [activeTab, setActiveTab] = useState("overview");
  const [announcements, setAnnouncements] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [performanceData, setPerformanceData] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quickStats, setQuickStats] = useState({
    students: 0,
    teachers: 0,
    classes: 0,
    events: 0,
  });

  // Mock data - in a real app, this would come from an API
  useEffect(() => {
    // Simulate API loading
    setTimeout(() => {
      setAnnouncements([
        {
          id: 1,
          title: "School Reopening",
          date: "2023-06-01",
          content: "School will reopen on June 5th after summer break.",
        },
        {
          id: 2,
          title: "Sports Day",
          date: "2023-06-15",
          content:
            "Annual sports day will be held on June 15th. All students must participate.",
        },
        {
          id: 3,
          title: "Parent-Teacher Meeting",
          date: "2023-06-20",
          content: "PTM scheduled for June 20th at 2 PM in the auditorium.",
        },
      ]);

      setAttendanceData([
        { name: "Jan", present: 85, absent: 15 },
        { name: "Feb", present: 88, absent: 12 },
        { name: "Mar", present: 82, absent: 18 },
        { name: "Apr", present: 90, absent: 10 },
        { name: "May", present: 87, absent: 13 },
        { name: "Jun", present: 92, absent: 8 },
      ]);

      setPerformanceData([
        { name: "Math", score: 85 },
        { name: "Science", score: 78 },
        { name: "English", score: 92 },
        { name: "History", score: 88 },
        { name: "Arts", score: 95 },
      ]);

      setEvents([
        {
          id: 1,
          title: "Science Fair",
          date: "2023-06-10",
          location: "School Lab",
        },
        {
          id: 2,
          title: "Annual Day",
          date: "2023-06-25",
          location: "Auditorium",
        },
        {
          id: 3,
          title: "Field Trip",
          date: "2023-07-05",
          location: "City Museum",
        },
      ]);

      setQuickStats({
        students: 1245,
        teachers: 68,
        classes: 42,
        events: 7,
      });

      setLoading(false);
    }, 1000);
  }, []);

  // Colors for charts
  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

  if (loading) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <h1 className="text-3xl font-bold  mb-6">
        School Dashboard
      </h1>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Students"
          value={quickStats.students}
          icon="👨‍🎓"
          color="bg-blue-100 text-blue-600"
        />
        <StatCard
          title="Teachers"
          value={quickStats.teachers}
          icon="👩‍🏫"
          color="bg-green-100 text-green-600"
        />
        <StatCard
          title="Classes"
          value={quickStats.classes}
          icon="🏫"
          color="bg-purple-100 text-purple-600"
        />
        <StatCard
          title="Upcoming Events"
          value={quickStats.events}
          icon="📅"
          color="bg-yellow-100 text-yellow-600"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          className={`py-2 px-4 font-medium ${
            activeTab === "overview"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500"
          }`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          className={`py-2 px-4 font-medium ${
            activeTab === "academics"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500"
          }`}
          onClick={() => setActiveTab("academics")}
        >
          Academics
        </button>
        <button
          className={`py-2 px-4 font-medium ${
            activeTab === "attendance"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500"
          }`}
          onClick={() => setActiveTab("attendance")}
        >
          Attendance
        </button>
        <button
          className={`py-2 px-4 font-medium ${
            activeTab === "events"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500"
          }`}
          onClick={() => setActiveTab("events")}
        >
          Events
        </button>
      </div>

      {/* Tab Content */}
      <div className=" rounded-lg shadow p-6">
        {activeTab === "overview" && (
          <div>
            <h2 className="text-xl font-semibold mb-4">School Overview</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium mb-2">Attendance Trend</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={attendanceData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="present"
                        stroke="#8884d8"
                        activeDot={{ r: 8 }}
                      />
                      <Line type="monotone" dataKey="absent" stroke="#82ca9d" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <h3 className="font-medium mb-2">Subject Performance</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={performanceData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="score" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div className="mt-6">
              <h3 className="font-medium mb-2">Recent Announcements</h3>
              <div className="space-y-3">
                {announcements.map((announcement) => (
                  <AnnouncementCard
                    key={announcement.id}
                    announcement={announcement}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "academics" && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Academic Performance</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium mb-2">Subject-wise Distribution</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={performanceData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="score"
                        label={({ name, percent }) =>
                          `${name}: ${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {performanceData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <h3 className="font-medium mb-2">Exam Schedule</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <ul className="space-y-3">
                    <li className="flex justify-between border-b pb-2">
                      <span>Mid-Term Exams</span>
                      <span className="font-medium">June 12-16, 2023</span>
                    </li>
                    <li className="flex justify-between border-b pb-2">
                      <span>Science Practicals</span>
                      <span className="font-medium">June 19-20, 2023</span>
                    </li>
                    <li className="flex justify-between border-b pb-2">
                      <span>Final Exams</span>
                      <span className="font-medium">July 10-15, 2023</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Result Declaration</span>
                      <span className="font-medium">July 25, 2023</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "attendance" && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Attendance Records</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium mb-2">Monthly Attendance</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={attendanceData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="present"
                        stackId="a"
                        fill="#8884d8"
                        name="Present"
                      />
                      <Bar
                        dataKey="absent"
                        stackId="a"
                        fill="#ffc658"
                        name="Absent"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <h3 className="font-medium mb-2">Attendance Summary</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-3 rounded shadow">
                      <div className="text-sm text-gray-500">
                        Overall Attendance
                      </div>
                      <div className="text-2xl font-bold">89%</div>
                    </div>
                    <div className="bg-white p-3 rounded shadow">
                      <div className="text-sm text-gray-500">Best Month</div>
                      <div className="text-2xl font-bold">June (92%)</div>
                    </div>
                    <div className="bg-white p-3 rounded shadow">
                      <div className="text-sm text-gray-500">Improvement</div>
                      <div className="text-2xl font-bold text-green-600">
                        +7%
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded shadow">
                      <div className="text-sm text-gray-500">Lowest Month</div>
                      <div className="text-2xl font-bold">March (82%)</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "events" && (
          <div>
            <h2 className="text-xl font-semibold mb-4">School Events</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Component for stat cards
function StatCard({ title, value, icon, color }) {
  return (
    <div className={`p-4 rounded-lg shadow ${color}`}>
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
}

// Component for announcement cards
function AnnouncementCard({ announcement }) {
  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <h4 className="font-medium text-lg">{announcement.title}</h4>
        <span className="text-sm text-gray-500">
          {new Date(announcement.date).toLocaleDateString()}
        </span>
      </div>
      <p className="mt-2 text-gray-600">{announcement.content}</p>
    </div>
  );
}

// Component for event cards
function EventCard({ event }) {
  return (
    <div className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
      <div className="bg-blue-600 p-3 text-white">
        <h3 className="font-medium text-lg">{event.title}</h3>
      </div>
      <div className="p-4">
        <div className="flex items-center mb-2">
          <svg
            className="w-5 h-5 mr-2 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            ></path>
          </svg>
          <span>
            {new Date(event.date).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>
        <div className="flex items-center">
          <svg
            className="w-5 h-5 mr-2 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            ></path>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            ></path>
          </svg>
          <span>{event.location}</span>
        </div>
        <button className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition-colors">
          View Details
        </button>
      </div>
    </div>
  );
}

export default Dashboard;
