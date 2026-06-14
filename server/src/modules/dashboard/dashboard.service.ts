import { prisma } from "@/config/prisma.js";

export class DashboardService {
  private static formatDateKey(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  static async getAttendanceData(attendanceDays = 7) {
    const allowedDays = [7, 15, 30];
    const days = allowedDays.includes(attendanceDays) ? attendanceDays : 7;
    const currentDate = new Date();

    try {
      const timelineDates: string[] = [];
      for (let offset = days - 1; offset >= 0; offset -= 1) {
        const cursor = new Date(currentDate);
        cursor.setDate(currentDate.getDate() - offset);
        timelineDates.push(this.formatDateKey(cursor));
      }

      const startDate = timelineDates[0];
      const attendanceGrouped = await prisma.attendence.groupBy({
        by: ["date", "status"],
        where: {
          date: { gte: startDate },
          status: {
            in: ["present", "absent", "run-awayed"],
          },
        },
        _count: {
          _all: true,
        },
      });

      const countsByDate = new Map<
        string,
        { present: number; absent: number; run_awayed: number }
      >();

      for (const row of attendanceGrouped) {
        if (!timelineDates.includes(row.date)) continue;

        const current = countsByDate.get(row.date) ?? {
          present: 0,
          absent: 0,
          run_awayed: 0,
        };

        if (row.status === "present") current.present = row._count._all;
        else if (row.status === "absent") current.absent = row._count._all;
        else if (row.status === "run-awayed")
          current.run_awayed = row._count._all;

        countsByDate.set(row.date, current);
      }

      return timelineDates.map((date) => {
        const counts = countsByDate.get(date) ?? {
          present: 0,
          absent: 0,
          run_awayed: 0,
        };

        const [yearPart, monthPart, dayPart] = date.split("-").map(Number);
        const displayDate = new Date(yearPart, monthPart - 1, dayPart)
          .toLocaleDateString("en-US", {
            day: "2-digit",
            month: "short",
          })
          .replace(",", "");

        return {
          name: displayDate,
          present: counts.present,
          absent: counts.absent,
          run_awayed: counts.run_awayed,
          sort_date: date,
        };
      });
    } catch (error: any) {
      console.warn("Error fetching attendance data:", error.message);
      return [];
    }
  }

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
      events: upcomingEvents || [],
      examSchedule: (examSchedule || []).map((exam) => ({
        name: exam.exam_name || "Unnamed exam",
        start_date: exam.start_date,
        end_date: exam.end_date,
      })),
    };
  }
}
