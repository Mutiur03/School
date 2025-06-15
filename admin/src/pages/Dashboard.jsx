import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

function Dashboard() {
  // State for dashboard elements
  const [dashboardData, setDashboardData] = useState({
    quickStats: { students: 0, teachers: 0, events: 0 },
    announcements: [],
    attendanceData: [],
    events: [],
    examSchedule: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const navigate = useNavigate();

  // Fetch dashboard data from API
  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/dashboard");

      if (response.data.success) {
        setDashboardData(response.data.data);
      } else {
        throw new Error(response.data.message || "Failed to fetch data");
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "attendance", label: "Attendance", icon: "📈" },
    { id: "announcements", label: "Notices", icon: "📢" },
    { id: "events", label: "Events", icon: "📅" },
    { id: "exams", label: "Exams", icon: "📝" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-6 animate-pulse"></div>

          {/* Skeleton Tab Navigation */}
          <div className="flex flex-wrap gap-2 mb-6">
            {[...Array(5)].map((_, index) => (
              <div
                key={index}
                className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
              ></div>
            ))}
          </div>

          {/* Skeleton Quick Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {[...Array(3)].map((_, index) => (
              <StatCardSkeleton key={index} />
            ))}
          </div>

          {/* Skeleton Content */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="space-y-6">
              <ChartSkeleton />
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-4 w-32 animate-pulse"></div>
                <div className="space-y-3">
                  {[...Array(3)].map((_, index) => (
                    <AnnouncementSkeleton key={index} />
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-4 w-32 animate-pulse"></div>
                <div className="space-y-3">
                  {[...Array(3)].map((_, index) => (
                    <EventSkeleton key={index} />
                  ))}
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-4 w-32 animate-pulse"></div>
                <div className="space-y-3">
                  {[...Array(3)].map((_, index) => (
                    <div
                      key={index}
                      className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-2"
                    >
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="text-xl text-red-600 dark:text-red-400 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <div>Error: {error}</div>
        </div>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="space-y-6">
              {dashboardData.attendanceData && dashboardData.attendanceData.length > 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                    Attendance Overview
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dashboardData.attendanceData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="opacity-30"
                        />
                        <XAxis dataKey="name" className="text-sm" />
                        <YAxis className="text-sm" />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="present"
                          stroke="#3b82f6"
                          activeDot={{ r: 6 }}
                          name="Present"
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="absent"
                          stroke="#ef4444"
                          name="Absent"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                    Attendance Overview
                  </h3>
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <div className="text-6xl mb-4">📊</div>
                    <div>No attendance data available</div>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                  Quick Summary
                </h3>
                <div className="space-y-4 text-gray-700 dark:text-gray-300">
                  <div className="flex justify-between items-center">
                    <span>Total Students</span>
                    <span className="font-medium">
                      {dashboardData.quickStats.students}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Active Teachers</span>
                    <span className="font-medium">
                      {dashboardData.quickStats.teachers}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Upcoming Events</span>
                    <span className="font-medium">
                      {dashboardData.quickStats.events}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case "attendance":
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
              Attendance Trend Analysis
            </h3>
            {dashboardData.attendanceData && dashboardData.attendanceData.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboardData.attendanceData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="opacity-30"
                    />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="present"
                      stroke="#10b981"
                      activeDot={{ r: 8 }}
                      name="Present"
                      strokeWidth={3}
                    />
                    <Line
                      type="monotone"
                      dataKey="absent"
                      stroke="#f59e0b"
                      name="Absent"
                      strokeWidth={3}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <div className="text-6xl mb-4">📊</div>
                <div>No attendance data available</div>
              </div>
            )}
          </div>
        );
      case "announcements":
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Recent Notices & Announcements
              </h3>
              <button
                onClick={() => navigate('/notice')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center gap-2"
              >
                <span>View All</span>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 5l7 7-7 7"
                  ></path>
                </svg>
              </button>
            </div>
            {dashboardData.announcements.length > 0 ? (
              <div className="space-y-4">
                {dashboardData.announcements.map((announcement) => (
                  <AnnouncementCard
                    key={announcement.id}
                    announcement={announcement}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <div className="text-6xl mb-4">📢</div>
                <div>No announcements available</div>
              </div>
            )}
          </div>
        );
      case "events":
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Upcoming Events
              </h3>
              <button
                onClick={() => navigate('/events')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center gap-2"
              >
                <span>View All</span>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 5l7 7-7 7"
                  ></path>
                </svg>
              </button>
            </div>
            {dashboardData.events.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dashboardData.events.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <div className="text-6xl mb-4">📅</div>
                <div>No upcoming events</div>
              </div>
            )}
          </div>
        );
      case "exams":
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
              Examination Schedule
            </h3>
            {dashboardData.examSchedule.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="pb-3 text-gray-900 dark:text-white font-medium">
                        Exam Name
                      </th>
                      <th className="pb-3 text-gray-900 dark:text-white font-medium">
                        Start Date
                      </th>
                      <th className="pb-3 text-gray-900 dark:text-white font-medium">
                        End Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.examSchedule.map((exam, index) => (
                      <tr
                        key={index}
                        className="border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                      >
                        <td className="py-3 text-gray-900 dark:text-white font-medium">
                          {exam.name}
                        </td>
                        <td className="py-3 text-gray-600 dark:text-gray-400">
                          {new Date(exam.start_date).toLocaleDateString()}
                        </td>
                        <td className="py-3 text-gray-600 dark:text-gray-400">
                          {new Date(exam.end_date).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <div className="text-6xl mb-4">📝</div>
                <div>No exams scheduled</div>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-gray-900 dark:text-white">
          School Dashboard
        </h1>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <StatCard
            title="Total Students"
            value={dashboardData.quickStats.students}
            icon="👨‍🎓"
            color="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300"
          />
          <StatCard
            title="Teachers"
            value={dashboardData.quickStats.teachers}
            icon="👩‍🏫"
            color="bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300"
          />
          <StatCard
            title="Upcoming Events"
            value={dashboardData.quickStats.events}
            icon="📅"
            color="bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-300"
          />
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                  activeTab === tab.id
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm"
                }`}
              >
                <span className="text-sm">{tab.icon}</span>
                <span className="text-sm sm:text-base">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="mb-6">{renderTabContent()}</div>
      </div>
    </div>
  );
}

// Component for stat cards
function StatCard({ title, value, icon, color }) {
  return (
    <div
      className={`p-4 sm:p-6 rounded-lg shadow-md ${color} transition-transform hover:scale-105`}
    >
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm font-medium mb-1">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <div className="text-3xl">{icon}</div>
      </div>
    </div>
  );
}

// Component for announcement cards
function AnnouncementCard({ announcement }) {

  return (
    <div
      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-all duration-200 bg-white dark:bg-gray-800 cursor-pointer"
    >
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
        <h4 className="font-medium text-lg text-gray-900 dark:text-white truncate">
          {announcement.title}
        </h4>
        <span className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
          {new Date(announcement.date).toLocaleDateString()}
        </span>
      </div>
      <p className="mt-2 text-gray-600 dark:text-gray-300 line-clamp-2">
        {announcement.content}
      </p>
    </div>
  );
}

// Component for event cards
function EventCard({ event }) {

  return (
    <div
      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-all duration-200 bg-white dark:bg-gray-800 cursor-pointer"
    >
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-start">
          <h3 className="font-medium text-lg text-gray-900 dark:text-white truncate">
            {event.title}
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400 bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded flex-shrink-0 ml-2">
            {new Date(event.date).toLocaleDateString()}
          </span>
        </div>
        <div className="flex items-center text-gray-600 dark:text-gray-400">
          <svg
            className="w-4 h-4 mr-2 flex-shrink-0"
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
          <span className="truncate">{event.location}</span>
        </div>
      </div>
    </div>
  );
}

// Component for stat card skeleton
function StatCardSkeleton() {
  return (
    <div className="p-4 sm:p-6 rounded-lg shadow-md bg-gray-100 dark:bg-gray-800 animate-pulse">
      <div className="flex justify-between items-center">
        <div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2 w-24"></div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
        </div>
        <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    </div>
  );
}

// Component for chart skeleton
function ChartSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded mb-4 w-32 animate-pulse"></div>
      <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded animate-pulse flex items-end justify-around p-4">
        {[...Array(6)].map((_, index) => (
          <div
            key={index}
            className="bg-gray-200 dark:bg-gray-600 rounded-t"
            style={{
              height: `${Math.random() * 80 + 20}%`,
              width: "12%",
            }}
          ></div>
        ))}
      </div>
    </div>
  );
}

// Component for announcement skeleton
function AnnouncementSkeleton() {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 animate-pulse bg-white dark:bg-gray-800">
      <div className="flex justify-between items-start mb-2">
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
      </div>
    </div>
  );
}

// Component for event skeleton
function EventSkeleton() {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 animate-pulse bg-white dark:bg-gray-800">
      <div className="flex justify-between items-start mb-2">
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
      </div>
      <div className="flex items-center">
        <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded mr-2"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
      </div>
    </div>
  );
}

export default Dashboard;