import axios from "axios";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();


export const getSmsLogsController = async (req, res) => {
  if (!req.cookies.teacher_token && !req.cookies.admin_token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { status, date, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = {};

    
    if (status && status !== "all") {
      whereClause.status = status;
    }

    if (date) {
      whereClause.attendance_date = date;
    }

    
    let allowedStudentIds = null;

    if (req.cookies.teacher_token && !req.cookies.admin_token) {
      const token = req.cookies.teacher_token;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const teacher = await prisma.teachers.findUnique({
        where: { id: decoded.id },
        include: { levels: true },
      });

      if (!teacher) {
        res.clearCookie("teacher_token");
        return res.status(404).json({ message: "Teacher not found" });
      }

      if (teacher.levels && teacher.levels.length > 0) {
        const levelConditions = teacher.levels.map((level) => ({
          class: level.class_name,
          section: level.section,
          year: level.year,
        }));

        const allowedEnrollments = await prisma.student_enrollments.findMany({
          where: { OR: levelConditions },
          select: { student_id: true },
        });

        allowedStudentIds = allowedEnrollments.map((e) => e.student_id);
        whereClause.student_id = { in: allowedStudentIds };
      } else {
        whereClause.student_id = { in: [] }; 
      }
    }

    const [smsLogs, totalCount] = await Promise.all([
      prisma.sms_logs.findMany({
        where: whereClause,
        include: {
          student: {
            select: {
              id: true,
              login_id: true,
              name: true,
              batch: true,
              enrollments: {
                select: {
                  class: true,
                  section: true,
                  year: true,
                  roll: true,
                },
              },
            },
          },
        },
        orderBy: [{ created_at: "desc" }],
        skip: parseInt(offset),
        take: parseInt(limit),
      }),
      prisma.sms_logs.count({ where: whereClause }),
    ]);

    
    const stats = await prisma.sms_logs.groupBy({
      by: ["status"],
      where: allowedStudentIds ? { student_id: { in: allowedStudentIds } } : {},
      _count: {
        status: true,
      },
    });

    const statsObject = stats.reduce((acc, stat) => {
      acc[stat.status] = stat._count.status;
      return acc;
    }, {});

    res.status(200).json({
      smsLogs,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: parseInt(page),
      stats: statsObject,
    });
  } catch (error) {
    console.error("SMS logs fetch error:", error);
    res.status(500).json({
      error: "Internal Server Error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};


export const retrySmsController = async (req, res) => {
  if (!req.cookies.teacher_token && !req.cookies.admin_token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { smsLogIds } = req.body;

    if (!smsLogIds || !Array.isArray(smsLogIds)) {
      return res.status(400).json({ error: "Invalid SMS log IDs format" });
    }

    const API_KEY = process.env.BULK_SMS_API_KEY;

    if (!API_KEY) {
      return res.status(400).json({ error: "SMS API key not configured" });
    }

    let successCount = 0;
    let failedCount = 0;
    const results = [];

    for (const smsLogId of smsLogIds) {
      try {
        const smsLog = await prisma.sms_logs.findUnique({
          where: { id: smsLogId },
          include: {
            student: {
              select: {
                name: true,
              },
            },
          },
        });

        if (!smsLog) {
          results.push({
            smsLogId,
            status: "error",
            message: "SMS log not found",
          });
          failedCount++;
          continue;
        }

        if (smsLog.status === "sent") {
          results.push({
            smsLogId,
            status: "skipped",
            message: "SMS already sent successfully",
          });
          continue;
        }

        
        await prisma.sms_logs.update({
          where: { id: smsLogId },
          data: {
            retry_count: { increment: 1 },
            status: "pending",
            updated_at: new Date(),
          },
        });

        
        const smsResponse = await axios.post(
          `https:
            smsLog.phone_number
          }&msg=${encodeURIComponent(smsLog.message)}`
        );

        console.log(
          `SMS Retry API Response for ${smsLog.phone_number}:`,
          smsResponse.data
        );

        
        if (smsResponse.data.error !== 0) {
          await prisma.sms_logs.update({
            where: { id: smsLogId },
            data: {
              status: "failed",
              error_reason: `API Error ${smsResponse.data.error}: ${
                smsResponse.data.msg || "Unknown error"
              }`,
              updated_at: new Date(),
            },
          });

          results.push({
            smsLogId,
            status: "failed",
            message: `API Error ${smsResponse.data.error}: ${
              smsResponse.data.msg || "Unknown error"
            }`,
            studentName: smsLog.student.name,
          });
          failedCount++;
        } else {
          await prisma.sms_logs.update({
            where: { id: smsLogId },
            data: {
              status: "sent",
              error_reason: null,
              updated_at: new Date(),
            },
          });

          
          await prisma.attendence.updateMany({
            where: {
              student_id: smsLog.student_id,
              date: smsLog.attendance_date,
            },
            data: { send_msg: true },
          });

          results.push({
            smsLogId,
            status: "success",
            message: "SMS sent successfully",
            studentName: smsLog.student.name,
          });
          successCount++;
        }
      } catch (smsError) {
        console.error(
          `Failed to retry SMS for log ${smsLogId}:`,
          smsError.message
        );

        await prisma.sms_logs.update({
          where: { id: smsLogId },
          data: {
            status: "failed",
            error_reason: smsError.message,
            updated_at: new Date(),
          },
        });

        results.push({
          smsLogId,
          status: "failed",
          message: smsError.message,
        });
        failedCount++;
      }
    }

    res.status(200).json({
      message: `Retry completed: ${successCount} successful, ${failedCount} failed`,
      results,
      stats: {
        total: smsLogIds.length,
        successful: successCount,
        failed: failedCount,
      },
    });
  } catch (error) {
    console.error("SMS retry error:", error);
    res.status(500).json({
      error: "Internal Server Error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};


export const deleteSmsLogsController = async (req, res) => {
  if (!req.cookies.admin_token) {
    return res.status(401).json({ error: "Admin access required" });
  }

  try {
    const { smsLogIds } = req.body;

    if (!smsLogIds || !Array.isArray(smsLogIds)) {
      return res.status(400).json({ error: "Invalid SMS log IDs format" });
    }

    const deletedCount = await prisma.sms_logs.deleteMany({
      where: {
        id: { in: smsLogIds },
      },
    });

    res.status(200).json({
      message: `${deletedCount.count} SMS logs deleted successfully`,
      deletedCount: deletedCount.count,
    });
  } catch (error) {
    console.error("SMS logs deletion error:", error);
    res.status(500).json({
      error: "Internal Server Error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};


export const getSmsStatsController = async (req, res) => {
  if (!req.cookies.teacher_token && !req.cookies.admin_token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { startDate, endDate } = req.query;

    let whereClause = {};

    if (startDate && endDate) {
      whereClause.attendance_date = {
        gte: startDate,
        lte: endDate,
      };
    }

    
    if (req.cookies.teacher_token && !req.cookies.admin_token) {
      const token = req.cookies.teacher_token;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const teacher = await prisma.teachers.findUnique({
        where: { id: decoded.id },
        include: { levels: true },
      });

      if (!teacher) {
        res.clearCookie("teacher_token");
        return res.status(404).json({ message: "Teacher not found" });
      }

      if (teacher.levels && teacher.levels.length > 0) {
        const levelConditions = teacher.levels.map((level) => ({
          class: level.class_name,
          section: level.section,
          year: level.year,
        }));

        const allowedEnrollments = await prisma.student_enrollments.findMany({
          where: { OR: levelConditions },
          select: { student_id: true },
        });

        const allowedStudentIds = allowedEnrollments.map((e) => e.student_id);
        whereClause.student_id = { in: allowedStudentIds };
      } else {
        whereClause.student_id = { in: [] };
      }
    }

    const [statusStats, dailyStats, retryStats] = await Promise.all([
      
      prisma.sms_logs.groupBy({
        by: ["status"],
        where: whereClause,
        _count: { status: true },
      }),
      
      prisma.sms_logs.groupBy({
        by: ["attendance_date"],
        where: whereClause,
        _count: { attendance_date: true },
        orderBy: { attendance_date: "desc" },
        take: 30,
      }),
      
      prisma.sms_logs.groupBy({
        by: ["retry_count"],
        where: whereClause,
        _count: { retry_count: true },
        orderBy: { retry_count: "asc" },
      }),
    ]);

    const statusStatsObject = statusStats.reduce((acc, stat) => {
      acc[stat.status] = stat._count.status;
      return acc;
    }, {});

    res.status(200).json({
      statusStats: statusStatsObject,
      dailyStats,
      retryStats,
    });
  } catch (error) {
    console.error("SMS stats error:", error);
    res.status(500).json({
      error: "Internal Server Error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
