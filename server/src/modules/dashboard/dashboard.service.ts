import { prisma } from "@/config/prisma.js";

export class DashboardService {
  static async getDashboardData() {
    const year = new Date().getFullYear();
    const currentDate = new Date();

    // Helper function to convert MM-DD-YYYY to Date object
    const parseEventDate = (dateStr: string) => {
      const [month, day, year] = dateStr.split("-");
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    };

    // Execute queries with individual error handling
    let studentCount = 0;
    let teacherCount = 0;
    let announcements = [] as any[];
    let attendanceData = [] as any[];
    let events = [] as any[];
    let examSchedule = [] as any[];

    try {
      studentCount = await prisma.student_enrollments.count({
        where: { year: year },
      });
    } catch (error: any) {
      console.warn("Error fetching student count:", error.message);
    }

    try {
      teacherCount = await prisma.teachers.count({
        where: { available: true },
      });
    } catch (error: any) {
      console.warn("Error fetching teacher count:", error.message);
    }

    try {
      announcements = await prisma.notices.findMany({
        select: {
          id: true,
          title: true,
          created_at: true,
          file: true,
        },
        orderBy: { created_at: "desc" },
        take: 5,
      });
    } catch (error: any) {
      console.warn("Error fetching announcements:", error.message);
    }

    try {
      attendanceData = await prisma.$queryRaw`
        WITH LatestDates AS (
          SELECT DISTINCT date 
          FROM attendence 
          WHERE status IN ('present', 'absent', 'run-awayed')
          ORDER BY date DESC 
          LIMIT 15
        ),
        DateRange AS (
          SELECT 
            MIN(TO_DATE(date, 'YYYY-MM-DD')) as start_date,
            MAX(TO_DATE(date, 'YYYY-MM-DD')) as end_date
          FROM LatestDates
        ),
        GeneratedDates AS (
          SELECT generate_series(start_date, end_date, '1 day'::interval)::date as g_date
          FROM DateRange
        )
        SELECT 
          TO_CHAR(gd.g_date, 'DD Mon') as name,
          COUNT(CASE WHEN a.status = 'present' THEN 1 END)::integer as present,
          COUNT(CASE WHEN a.status = 'absent' THEN 1 END)::integer as absent,
          COUNT(CASE WHEN a.status = 'run-awayed' THEN 1 END)::integer as run_awayed,
          TO_CHAR(gd.g_date, 'YYYY-MM-DD') as sort_date
        FROM GeneratedDates gd
        LEFT JOIN attendence a ON a.date = TO_CHAR(gd.g_date, 'YYYY-MM-DD') AND a.status IN ('present', 'absent', 'run-awayed')
        GROUP BY gd.g_date
        ORDER BY gd.g_date ASC
      `;
    } catch (error: any) {
      console.warn("Error fetching attendance data:", error.message);
    }

    try {
      events = await prisma.events.findMany({
        select: {
          id: true,
          title: true,
          date: true,
          location: true,
          details: true,
        },
        orderBy: { date: "asc" },
      });
    } catch (error: any) {
      console.warn("Error fetching events:", error.message);
    }

    try {
      examSchedule = await prisma.exams.findMany({
        where: {
          exam_year: year,
        },
        select: {
          exam_name: true,
          start_date: true,
          end_date: true,
          exam_year: true,
        },
        orderBy: { start_date: "asc" },
        take: 5,
      });
    } catch (error: any) {
      console.warn("Error fetching exam schedule:", error.message);
    }

    // Filter events that are upcoming (date >= current date)
    const upcomingEvents = (events || [])
      .filter((event) => {
        try {
          if (!event.date) return false;
          const eventDate = parseEventDate(event.date);
          return eventDate >= currentDate;
        } catch {
          console.error("Error parsing event date:", event.date);
          return false;
        }
      })
      .slice(0, 10);

    // Count upcoming events
    const upcomingEventCount = (events || []).filter((event) => {
      try {
        if (!event.date) return false;
        const eventDate = parseEventDate(event.date);
        return eventDate >= currentDate;
      } catch {
        return false;
      }
    }).length;

    const formattedAnnouncements = (announcements || []).map(
      (announcement) => ({
        id: announcement.id,
        title: announcement.title || "No title",
        content: "No details available",
        date: announcement.created_at,
        url: announcement.file,
      }),
    );

    return {
      quickStats: {
        students: studentCount || 0,
        teachers: teacherCount || 0,
        events: upcomingEventCount || 0,
      },
      announcements: formattedAnnouncements,
      attendanceData: attendanceData || [],
      events: upcomingEvents || [],
      examSchedule: (examSchedule || []).map((exam) => ({
        name: exam.exam_name || "Unnamed exam",
        start_date: exam.start_date,
        end_date: exam.end_date,
      })),
    };
  }
}
