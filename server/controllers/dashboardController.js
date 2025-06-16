import { prisma } from "../config/prisma.js";

export const getAllDashboardData = async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const currentDate = new Date();

    // Helper function to convert MM-DD-YYYY to Date object
    const parseEventDate = (dateStr) => {
      const [month, day, year] = dateStr.split("-");
      return new Date(year, month - 1, day);
    };

    // Execute queries with individual error handling
    let studentCount = 0;
    let teacherCount = 0;
    let eventCount = 0;
    let announcements = [];
    let attendanceData = [];
    let events = [];
    let examSchedule = [];

    try {
      studentCount = await prisma.student_enrollments.count({
        where: { year: year },
      });
    } catch (error) {
      console.warn("Error fetching student count:", error.message);
    }

    try {
      teacherCount = await prisma.teachers.count({
        where: { available: true },
      });
    } catch (error) {
      console.warn("Error fetching teacher count:", error.message);
    }

    try {
      eventCount = await prisma.events.count();
    } catch (error) {
      console.warn("Error fetching event count:", error.message);
    }

    try {
      announcements = await prisma.notices.findMany({
        select: {
          id: true,
          title: true,
          details: true,
          created_at: true,
        },
        orderBy: { created_at: "desc" },
        take: 5,
      });
    } catch (error) {
      console.warn("Error fetching announcements:", error.message);
    }

    try {
      attendanceData = await prisma.$queryRaw`
        SELECT 
          TO_CHAR(TO_DATE(date, 'YYYY-MM-DD'), 'Mon') as name,
          COUNT(CASE WHEN status = 'present' THEN 1 END)::integer as present,
          COUNT(CASE WHEN status = 'absent' THEN 1 END)::integer as absent
        FROM attendence 
        WHERE date LIKE ${year + "%"}
          AND status IN ('present', 'absent')
        GROUP BY TO_CHAR(TO_DATE(date, 'YYYY-MM-DD'), 'Mon'), EXTRACT(MONTH FROM TO_DATE(date, 'YYYY-MM-DD'))
        ORDER BY EXTRACT(MONTH FROM TO_DATE(date, 'YYYY-MM-DD'))
      `;
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      console.warn("Error fetching exam schedule:", error.message);
    }

    // Filter events that are upcoming (date >= current date)
    const upcomingEvents = (events || [])
      .filter((event) => {
        try {
          if (!event.date) return false;
          const eventDate = parseEventDate(event.date);
          return eventDate >= currentDate;
        } catch (error) {
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
      } catch (error) {
        return false;
      }
    }).length;

    const formattedAnnouncements = (announcements || []).map(
      (announcement) => ({
        id: announcement.id,
        title: announcement.title || "No title",
        content: announcement.details || "No details available",
        date: announcement.created_at,
      })
    );

    const allData = {
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

    res.status(200).json({
      success: true,
      data: allData,
      message:
        allData.announcements.length === 0 &&
        allData.events.length === 0 &&
        allData.examSchedule.length === 0
          ? "Dashboard data retrieved successfully (no announcements, events, or exams found)"
          : "All dashboard data retrieved successfully",
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving dashboard data",
      error: error.message,
      data: {
        quickStats: { students: 0, teachers: 0, events: 0 },
        announcements: [],
        attendanceData: [],
        events: [],
        examSchedule: [],
      },
    });
  }
};
