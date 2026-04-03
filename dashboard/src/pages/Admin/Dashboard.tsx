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
import { Users, UserCheck, Calendar, Bell, GraduationCap, ClipboardList } from "lucide-react";
import { PageHeader, SectionCard, StatsCard } from "@/components";

interface Announcement {
  id: number;
  title: string;
  content: string;
  date: string;
  url: string;
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
  icon: React.ReactNode;
}

const COLORS = {
  present: "#3b82f6", // Blue
  absent: "#ef4444",  // Red
};

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
    { id: "overview", label: "Overview", icon: <GraduationCap className="w-4 h-4" /> },
    { id: "attendance", label: "Attendance", icon: <UserCheck className="w-4 h-4" /> },
    { id: "announcements", label: "Notices", icon: <Bell className="w-4 h-4" /> },
    { id: "events", label: "Events", icon: <Calendar className="w-4 h-4" /> },
    { id: "exams", label: "Exams", icon: <ClipboardList className="w-4 h-4" /> },
  ];

  if (loading) {
    return (
      <div className="min-h-screen p-4 sm:p-6 lg:p-8 animate-pulse text-gray-500">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="h-12 w-64 bg-muted rounded-lg"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-muted rounded-xl"></div>
            ))}
          </div>
          <div className="h-10 w-full max-w-md bg-muted rounded-lg"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="h-96 bg-muted rounded-xl"></div>
            <div className="h-96 bg-muted rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <SectionCard className="max-w-md w-full text-center p-8">
          <div className="text-destructive text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:shadow-lg transition-all"
          >
            Try Again
          </button>
        </SectionCard>
      </div>
    );
  }

  const renderAttendanceSection = (title: string) => {
    const hasData = dashboardData.attendanceData && dashboardData.attendanceData.length > 0;

    return (
      <SectionCard title={title} className="w-full">
        {hasData ? (
          <div className="flex flex-col">
            <div className="h-64 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dashboardData.attendanceData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 11 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 11 }} 
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} 
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    align="center" 
                    content={(props) => {
                      const { payload } = props;
                      return (
                        <div className="flex justify-center gap-6 mt-6">
                          {payload?.map((entry: any, index: number) => (
                            <div key={`item-${index}`} className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full border-2 bg-white shadow-sm" 
                                style={{ borderColor: entry.color }}
                              />
                              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{entry.value}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="present"
                    stroke={COLORS.present}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#fff', stroke: COLORS.present, strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: COLORS.present, stroke: '#fff', strokeWidth: 2 }}
                    name="Present"
                  />
                  <Line
                    type="monotone"
                    dataKey="absent"
                    stroke={COLORS.absent}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#fff', stroke: COLORS.absent, strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: COLORS.absent, stroke: '#fff', strokeWidth: 2 }}
                    name="Absent"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <GraduationCap className="w-16 h-16 mb-4 opacity-20" />
            <p>No attendance data recorded yet.</p>
          </div>
        )}
      </SectionCard>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
            <div className="space-y-6 lg:space-y-8">
              {renderAttendanceSection("Attendance Overview")}
              <SectionCard title="Quick Summary">
                <div className="space-y-4">
                  {[
                    { label: "Total Students", value: dashboardData.quickStats.students, icon: <Users className="w-4 h-4 text-blue-500" /> },
                    { label: "Active Teachers", value: dashboardData.quickStats.teachers, icon: <UserCheck className="w-4 h-4 text-green-500" /> },
                    { label: "Upcoming Events", value: dashboardData.quickStats.events, icon: <Calendar className="w-4 h-4 text-yellow-500" /> },
                  ].map((stat) => (
                    <div key={stat.label} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-background border border-border shadow-sm">
                          {stat.icon}
                        </div>
                        <span className="font-medium text-sm sm:text-base">{stat.label}</span>
                      </div>
                      <span className="text-lg font-bold">{stat.value}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
            <div className="space-y-6 lg:space-y-8">
              <SectionCard
                title="Recent Notices"
                headerAction={
                  <button onClick={() => navigate('/admin/notice')} className="text-primary text-sm font-medium hover:underline">
                    View All
                  </button>
                }
              >
                <div className="space-y-4">
                  {dashboardData.announcements.length > 0 ? (
                    dashboardData.announcements.slice(0, 3).map((notice) => (
                      <a href={notice.url} target="_blank" key={notice.id} className="block border-l-4 border-primary bg-muted/30 p-4 rounded-r-lg group cursor-pointer hover:bg-muted/50 transition-all">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold text-sm sm:text-base group-hover:text-primary transition-colors line-clamp-1">{notice.title}</h4>
                          <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">{new Date(notice.date).toLocaleDateString()}</span>
                        </div>
                      </a>
                    ))
                  ) : (
                    <p className="text-center py-8 text-muted-foreground">No recent notices.</p>
                  )}
                </div>
              </SectionCard>
              <SectionCard
                title="Upcoming Events"
                headerAction={
                  <button onClick={() => navigate('/admin/events')} className="text-primary text-sm font-medium hover:underline">
                    View All
                  </button>
                }
              >
                <div className="space-y-4">
                  {dashboardData.events.length > 0 ? (
                    dashboardData.events.slice(0, 3).map((event) => (
                      <div key={event.id} className="flex gap-4 p-3 rounded-lg hover:bg-muted/30 transition-colors border border-transparent hover:border-border">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex flex-col items-center justify-center text-primary shrink-0">
                          <span className="text-xs font-bold uppercase">{new Date(event.date).toLocaleString('default', { month: 'short' })}</span>
                          <span className="text-lg font-bold leading-tight">{new Date(event.date).getDate()}</span>
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-sm sm:text-base line-clamp-1">{event.title}</h4>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {event.location}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center py-8 text-muted-foreground">No upcoming events.</p>
                  )}
                </div>
              </SectionCard>
            </div>
          </div>
        );
      case "attendance":
        return renderAttendanceSection("Attendance Trend Analysis");
      case "announcements":
        return (
          <SectionCard title="Notices & Announcements">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dashboardData.announcements.map((notice) => (
                <a href={notice.url} target="_blank" key={notice.id} className="block p-5 rounded-xl border border-border hover:border-primary/50 hover:shadow-md transition-all bg-card">
                  <div className="flex justify-between items-start mb-3">
                    <span className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded uppercase tracking-wider">Notice</span>
                    <span className="text-xs text-muted-foreground">{new Date(notice.date).toLocaleDateString()}</span>
                  </div>
                  <h4 className="font-bold mb-2 group-hover:text-primary transition-colors">{notice.title}</h4>
                </a>
              ))}
            </div>
          </SectionCard>
        );
      case "events":
        return (
          <SectionCard title="Scheduled Events">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {dashboardData.events.map((event) => (
                <div key={event.id} className="group overflow-hidden rounded-xl border border-border bg-card hover:shadow-lg transition-all">
                  <div className="h-32 bg-primary/5 flex items-center justify-center border-b border-border transition-colors group-hover:bg-primary/10">
                    <Calendar className="w-12 h-12 text-primary opacity-20" />
                  </div>
                  <div className="p-5">
                    <h4 className="font-bold mb-3 line-clamp-2">{event.title}</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(event.date).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="w-3.5 h-3.5" />
                        {event.location}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        );
      case "exams":
        return (
          <SectionCard title="Examination Schedule">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">Exam Name</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">Start Date</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">End Date</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {dashboardData.examSchedule.map((exam, index) => {
                    const now = new Date();
                    const start = new Date(exam.start_date);
                    const end = new Date(exam.end_date);
                    const isUpcoming = start > now;
                    const isOngoing = now >= start && now <= end;

                    return (
                      <tr key={index} className="hover:bg-muted/20 transition-colors">
                        <td className="px-6 py-4 font-semibold text-sm">{exam.name}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{start.toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{end.toLocaleDateString()}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${isOngoing ? 'bg-green-500/10 text-green-500' : isUpcoming ? 'bg-blue-500/10 text-blue-500' : 'bg-muted text-muted-foreground'}`}>
                            {isOngoing ? 'Ongoing' : isUpcoming ? 'Upcoming' : 'Completed'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {dashboardData.examSchedule.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">No exams scheduled.</div>
              )}
            </div>
          </SectionCard>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-10 bg-muted/10 dark:bg-zinc-950/20">
      <div className="max-w-7xl mx-auto space-y-8 lg:space-y-10">
        <PageHeader
          title="Campus Dashboard"
          description={`Welcome back, Administrator. Last updated: ${new Date().toLocaleTimeString()}.`}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatsCard
            label="Total Students"
            value={dashboardData.quickStats.students}
            icon={<Users className="w-6 h-6" />}
            color="blue"
            loading={false}
          />
          <StatsCard
            label="Active Faculty"
            value={dashboardData.quickStats.teachers}
            icon={<UserCheck className="w-6 h-6" />}
            color="emerald"
            loading={false}
          />
          <StatsCard
            label="Scheduled Events"
            value={dashboardData.quickStats.events}
            icon={<Calendar className="w-6 h-6" />}
            color="amber"
            loading={false}
          />
        </div>

        <div className="space-y-6">
          <div className="flex gap-2 p-1 bg-muted/50 rounded-xl w-fit overflow-x-auto scrollbar-hide max-w-full">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 sm:px-6 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 shrink-0 ${activeTab === tab.id
                  ? "bg-card text-primary shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted-foreground/5"
                  }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          <div key={activeTab} className="animate-fade-in-up">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;