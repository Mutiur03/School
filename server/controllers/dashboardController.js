import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const getAllDashboardData = async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const currentDate = new Date();
    
    // Helper function to convert MM-DD-YYYY to Date object
    const parseEventDate = (dateStr) => {
      const [month, day, year] = dateStr.split('-');
      return new Date(year, month - 1, day);
    };
    
    const [
      studentCount,
      teacherCount,
      eventCount,
      announcements,
      attendanceData,
      events,
      examSchedule,
    ] = await Promise.all([
      prisma.student_enrollments.count({ where: { year: year } }),
      prisma.teachers.count({ where: { available: true } }),
      // Get all events and filter in JavaScript since date format is MM-DD-YYYY
      prisma.events.count(),
      prisma.notices.findMany({
        select: {
          id: true,
          title: true,
          details: true,
          created_at: true,
        },
        orderBy: { created_at: "desc" },
        take: 5,
      }),
      prisma.$queryRaw`
        SELECT 
          TO_CHAR(TO_DATE(date, 'YYYY-MM-DD'), 'Mon') as name,
          COUNT(CASE WHEN status = 'present' THEN 1 END)::integer as present,
          COUNT(CASE WHEN status = 'absent' THEN 1 END)::integer as absent
        FROM attendence 
        WHERE date LIKE ${year + "%"}
          AND status IN ('present', 'absent')
        GROUP BY TO_CHAR(TO_DATE(date, 'YYYY-MM-DD'), 'Mon'), EXTRACT(MONTH FROM TO_DATE(date, 'YYYY-MM-DD'))
        ORDER BY EXTRACT(MONTH FROM TO_DATE(date, 'YYYY-MM-DD'))
      `,
      // Get all events and filter by date in JavaScript
      prisma.events.findMany({
        select: {
          id: true,
          title: true,
          date: true,
          location: true,
          details: true,
        },
        orderBy: { date: "asc" },
      }),
      prisma.exams.findMany({
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
      }),
    ]);

    // Filter events that are upcoming (date >= current date)
    const upcomingEvents = events.filter(event => {
      try {
        const eventDate = parseEventDate(event.date);
        return eventDate >= currentDate;
      } catch (error) {
        console.error('Error parsing event date:', event.date);
        return false;
      }
    }).slice(0, 10);

    // Count upcoming events
    const upcomingEventCount = events.filter(event => {
      try {
        const eventDate = parseEventDate(event.date);
        return eventDate >= currentDate;
      } catch (error) {
        return false;
      }
    }).length;

    const formattedAnnouncements = announcements.map((announcement) => ({
      id: announcement.id,
      title: announcement.title,
      content: announcement.details,
      date: announcement.created_at,
    }));
    const allData = {
      quickStats: {
        students: studentCount,
        teachers: teacherCount,
        events: upcomingEventCount,
      },
      announcements: formattedAnnouncements,
      attendanceData: attendanceData || [],
      events: upcomingEvents,
      examSchedule: examSchedule.map((exam) => ({
        name: exam.exam_name,
        start_date: exam.start_date,
        end_date: exam.end_date,
      })),
    };
    res.status(200).json({
      success: true,
      data: allData,
      message: "All dashboard data retrieved successfully",
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving dashboard data",
      error: error.message,
    });
  }
};
