import { useState, useEffect } from "react";
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

interface Announcement {
  id: number;
  title: string;
  content: string;
  date: string;
}

interface Event {
  id: number;
  title: string;
  date: string;
  location: string;
}

interface AttendanceData {
  name: string;
  present: number;
  absent: number;
}

interface ExamSchedule {
  name: string;
  start_date: string;
  end_date: string;
}

interface DashboardData {
  quickStats: {
    students: number;
    teachers: number;
    events: number;
  };
  announcements: Announcement[];
  attendanceData: AttendanceData[];
  events: Event[];
  examSchedule: ExamSchedule[];
}

interface Tab {
  id: string;
  label: string;
  icon: string;
}

interface StatCardProps {
  title: string;
  value: number;
  icon: string;
  color: string;
}

interface AnnouncementCardProps {
  announcement: Announcement;
}

interface EventCardProps {
  event: Event;
}

function Dashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    quickStats: { students: 0, teachers: 0, events: 0 },
    announcements: [],
    attendanceData: [],
    events: [],
    examSchedule: [],
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const navigate = useNavigate();

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
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setError(error.response?.data?.message || error.message || "An error occurred");
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const tabs: Tab[] = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "attendance", label: "Attendance", icon: "📈" },
    { id: "announcements", label: "Notices", icon: "📢" },
    { id: "events", label: "Events", icon: "📅" },
    { id: "exams", label: "Exams", icon: "📝" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen p-2 sm:p-4 lg:p-6 xl:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="h-6 sm:h-8 bg-gray-200 dark:bg-gray-700 rounded mb-4 sm:mb-6 animate-pulse"></div>

          <div className="flex flex-wrap gap-1 sm:gap-2 mb-4 sm:mb-6 overflow-x-auto">
            {[...Array(5)].map((_, index) => (
              <div
                key={index}
                className="h-8 sm:h-10 w-20 sm:w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse flex-shrink-0"
              ></div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
            {[...Array(3)].map((_, index) => (
              <StatCardSkeleton key={index} />
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-4 sm:space-y-6">
              <ChartSkeleton />
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-6">
                <div className="h-5 sm:h-6 bg-gray-200 dark:bg-gray-700 rounded mb-3 sm:mb-4 w-28 sm:w-32 animate-pulse"></div>
                <div className="space-y-2 sm:space-y-3">
                  {[...Array(3)].map((_, index) => (
                    <AnnouncementSkeleton key={index} />
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-6">
                <div className="h-5 sm:h-6 bg-gray-200 dark:bg-gray-700 rounded mb-3 sm:mb-4 w-28 sm:w-32 animate-pulse"></div>
                <div className="space-y-2 sm:space-y-3">
                  {[...Array(3)].map((_, index) => (
                    <EventSkeleton key={index} />
                  ))}
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-6">
                <div className="h-5 sm:h-6 bg-gray-200 dark:bg-gray-700 rounded mb-3 sm:mb-4 w-28 sm:w-32 animate-pulse"></div>
                <div className="space-y-2 sm:space-y-3">
                  {[...Array(3)].map((_, index) => (
                    <div
                      key={index}
                      className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-2"
                    >
                      <div className="h-3 sm:h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 sm:w-24 animate-pulse"></div>
                      <div className="h-3 sm:h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 sm:w-32 animate-pulse"></div>
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
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-4 sm:space-y-6">
              {dashboardData.attendanceData && dashboardData.attendanceData.length > 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 sm:p-6">
                  <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-white">
                    Attendance Overview
                  </h3>
                  <div className="h-48 sm:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dashboardData.attendanceData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="opacity-30"
                        />
                        <XAxis dataKey="name" className="text-xs sm:text-sm" tick={{ fontSize: 12 }} />
                        <YAxis className="text-xs sm:text-sm" tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="present"
                          stroke="#3b82f6"
                          activeDot={{ r: 4 }}
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
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 sm:p-6">
                  <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-white">
                    Attendance Overview
                  </h3>
                  <div className="text-center py-8 sm:py-12 text-gray-500 dark:text-gray-400">
                    <div className="text-4xl sm:text-6xl mb-2 sm:mb-4">📊</div>
                    <div className="text-sm sm:text-base">No attendance data available</div>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-white">
                  Quick Summary
                </h3>
                <div className="space-y-3 sm:space-y-4 text-gray-700 dark:text-gray-300">
                  <div className="flex justify-between items-center">
                    <span className="text-sm sm:text-base">Total Students</span>
                    <span className="font-medium text-sm sm:text-base">
                      {dashboardData.quickStats.students}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm sm:text-base">Active Teachers</span>
                    <span className="font-medium text-sm sm:text-base">
                      {dashboardData.quickStats.teachers}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm sm:text-base">Upcoming Events</span>
                    <span className="font-medium text-sm sm:text-base">
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 sm:p-6">
            <h3 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-6 text-gray-900 dark:text-white">
              Attendance Trend Analysis
            </h3>
            {dashboardData.attendanceData && dashboardData.attendanceData.length > 0 ? (
              <div className="h-64 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboardData.attendanceData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="opacity-30"
                    />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="present"
                      stroke="#10b981"
                      activeDot={{ r: 6 }}
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
              <div className="text-center py-8 sm:py-12 text-gray-500 dark:text-gray-400">
                <div className="text-4xl sm:text-6xl mb-2 sm:mb-4">📊</div>
                <div className="text-sm sm:text-base">No attendance data available</div>
              </div>
            )}
          </div>
        );
      case "announcements":
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-3">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                Recent Notices & Announcements
              </h3>
              <button
                onClick={() => navigate('/notice')}
                className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center gap-2 text-sm sm:text-base"
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
              <div className="space-y-3 sm:space-y-4">
                {dashboardData.announcements.map((announcement) => (
                  <AnnouncementCard
                    key={announcement.id}
                    announcement={announcement}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 sm:py-12 text-gray-500 dark:text-gray-400">
                <div className="text-4xl sm:text-6xl mb-2 sm:mb-4">📢</div>
                <div className="text-sm sm:text-base">No announcements available</div>
              </div>
            )}
          </div>
        );
      case "events":
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-3">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                Upcoming Events
              </h3>
              <button
                onClick={() => navigate('/events')}
                className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center gap-2 text-sm sm:text-base"
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                {dashboardData.events.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 sm:py-12 text-gray-500 dark:text-gray-400">
                <div className="text-4xl sm:text-6xl mb-2 sm:mb-4">📅</div>
                <div className="text-sm sm:text-base">No upcoming events</div>
              </div>
            )}
          </div>
        );
      case "exams":
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 sm:p-6">
            <h3 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-6 text-gray-900 dark:text-white">
              Examination Schedule
            </h3>
            {dashboardData.examSchedule.length > 0 ? (
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <div className="inline-block min-w-full px-3 sm:px-0">
                  <table className="w-full text-left min-w-[500px] sm:min-w-0">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="pb-2 sm:pb-3 text-gray-900 dark:text-white font-medium text-sm sm:text-base">
                          Exam Name
                        </th>
                        <th className="pb-2 sm:pb-3 text-gray-900 dark:text-white font-medium text-sm sm:text-base">
                          Start Date
                        </th>
                        <th className="pb-2 sm:pb-3 text-gray-900 dark:text-white font-medium text-sm sm:text-base">
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
                          <td className="py-2 sm:py-3 text-gray-900 dark:text-white font-medium text-sm sm:text-base">
                            {exam.name}
                          </td>
                          <td className="py-2 sm:py-3 text-gray-600 dark:text-gray-400 text-sm sm:text-base">
                            {new Date(exam.start_date).toLocaleDateString()}
                          </td>
                          <td className="py-2 sm:py-3 text-gray-600 dark:text-gray-400 text-sm sm:text-base">
                            {new Date(exam.end_date).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 sm:py-12 text-gray-500 dark:text-gray-400">
                <div className="text-4xl sm:text-6xl mb-2 sm:mb-4">📝</div>
                <div className="text-sm sm:text-base">No exams scheduled</div>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen p-2 sm:p-4 lg:p-6 xl:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-4 sm:mb-6 text-gray-900 dark:text-white px-1">
          School Dashboard
        </h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
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

        <div className="mb-4 sm:mb-6">
          <div className="flex gap-1 sm:gap-2 overflow-x-auto pb-2 px-1 scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-1 sm:gap-2 whitespace-nowrap flex-shrink-0 text-sm sm:text-base ${activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm"
                  }`}
              >
                <span className="text-xs sm:text-sm">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 sm:mb-6">{renderTabContent()}</div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <div
      className={`p-3 sm:p-4 lg:p-6 rounded-lg shadow-md ${color} transition-transform hover:scale-105`}
    >
      <div className="flex justify-between items-center">
        <div>
          <p className="text-xs sm:text-sm font-medium mb-1">{title}</p>
          <p className="text-xl sm:text-2xl font-bold">{value}</p>
        </div>
        <div className="text-2xl sm:text-3xl">{icon}</div>
      </div>
    </div>
  );
}

function AnnouncementCard({ announcement }: AnnouncementCardProps) {
  return (
    <div
      className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 hover:shadow-md transition-all duration-200 bg-white dark:bg-gray-800 cursor-pointer"
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-2">
          <h4 className="font-medium text-base sm:text-lg text-gray-900 dark:text-white line-clamp-2 sm:truncate">
            {announcement.title}
          </h4>
          <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
            {new Date(announcement.date).toLocaleDateString()}
          </span>
        </div>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 line-clamp-3">
          {announcement.content}
        </p>
      </div>
    </div>
  );
}

function EventCard({ event }: EventCardProps) {
  return (
    <div
      className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 hover:shadow-md transition-all duration-200 bg-white dark:bg-gray-800 cursor-pointer"
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-2">
          <h3 className="font-medium text-base sm:text-lg text-gray-900 dark:text-white line-clamp-2">
            {event.title}
          </h3>
          <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded flex-shrink-0 self-start">
            {new Date(event.date).toLocaleDateString()}
          </span>
        </div>
        <div className="flex items-center text-gray-600 dark:text-gray-400">
          <svg
            className="w-3 h-3 sm:w-4 sm:h-4 mr-2 flex-shrink-0"
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
          <span className="truncate text-sm sm:text-base">{event.location}</span>
        </div>
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="p-3 sm:p-4 lg:p-6 rounded-lg shadow-md bg-gray-100 dark:bg-gray-800 animate-pulse">
      <div className="flex justify-between items-center">
        <div>
          <div className="h-3 sm:h-4 bg-gray-200 dark:bg-gray-700 rounded mb-1 sm:mb-2 w-20 sm:w-24"></div>
          <div className="h-6 sm:h-8 bg-gray-200 dark:bg-gray-700 rounded w-12 sm:w-16"></div>
        </div>
        <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 sm:p-6">
      <div className="h-4 sm:h-5 bg-gray-200 dark:bg-gray-700 rounded mb-3 sm:mb-4 w-28 sm:w-32 animate-pulse"></div>
      <div className="h-48 sm:h-64 bg-gray-100 dark:bg-gray-700 rounded animate-pulse flex items-end justify-around p-2 sm:p-4">
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

function AnnouncementSkeleton() {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 animate-pulse bg-white dark:bg-gray-800">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 gap-1 sm:gap-2">
        <div className="h-4 sm:h-5 bg-gray-200 dark:bg-gray-700 rounded w-40 sm:w-48"></div>
        <div className="h-3 sm:h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 sm:w-20"></div>
      </div>
      <div className="space-y-1 sm:space-y-2">
        <div className="h-3 sm:h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
        <div className="h-3 sm:h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
      </div>
    </div>
  );
}

function EventSkeleton() {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 animate-pulse bg-white dark:bg-gray-800">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 gap-1 sm:gap-2">
        <div className="h-4 sm:h-5 bg-gray-200 dark:bg-gray-700 rounded w-28 sm:w-32"></div>
        <div className="h-3 sm:h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 sm:w-20"></div>
      </div>
      <div className="flex items-center">
        <div className="w-3 h-3 sm:w-4 sm:h-4 bg-gray-200 dark:bg-gray-700 rounded mr-2"></div>
        <div className="h-3 sm:h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 sm:w-24"></div>
      </div>
    </div>
  );
}

export default Dashboard;