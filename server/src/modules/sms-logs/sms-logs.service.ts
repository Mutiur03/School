import axios from "axios";
import { prisma } from "@/config/prisma.js";

type UserContext = {
  role?: string;
  levels?: { class_name: number; section: string; year: number }[];
};

type LogFilters = {
  status?: string;
  date?: string;
  page?: number;
  limit?: number;
};

type StatsFilters = {
  startDate?: string;
  endDate?: string;
};

const sendBulkSMS = async (messageParameters: any[], apiKey: string, senderId: string) => {
  const bulkSmsPayload = {
    api_key: apiKey,
    senderid: senderId,
    MessageParameters: messageParameters,
  };

  const response = await axios.post(
    "https://sms.onecodesoft.com/api/send-bulk-sms",
    bulkSmsPayload,
    {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    },
  );

  return response.data;
};

const buildTeacherStudentFilter = async (user?: UserContext) => {
  if (!user || user.role !== "teacher") return null;

  if (!user.levels || user.levels.length === 0) {
    return { in: [] as number[] };
  }

  const levelConditions = user.levels.map((level) => ({
    class: level.class_name,
    section: level.section,
    year: level.year,
  }));

  const allowedEnrollments = await prisma.student_enrollments.findMany({
    where: { OR: levelConditions },
    select: { student_id: true },
  });

  const allowedStudentIds = allowedEnrollments.map((e) => e.student_id);
  return { in: allowedStudentIds };
};

export class SmsLogsService {
  static async getSmsLogs(filters: LogFilters, user?: UserContext) {
    const { status, date, page = 1, limit = 50 } = filters;
    const offset = (page - 1) * limit;

    const whereClause: any = {};

    if (status && status !== "all") {
      whereClause.status = status;
    }

    if (date) {
      whereClause.attendance_date = date;
    }

    const studentFilter = await buildTeacherStudentFilter(user);
    if (studentFilter) {
      whereClause.student_id = studentFilter;
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
        skip: Number(offset),
        take: Number(limit),
      }),
      prisma.sms_logs.count({ where: whereClause }),
    ]);

    const stats = await prisma.sms_logs.groupBy({
      by: ["status"],
      where: whereClause,
      _count: {
        status: true,
      },
    });

    const statsObject = stats.reduce((acc: any, stat) => {
      acc[stat.status] = stat._count.status;
      return acc;
    }, {});

    return {
      smsLogs,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: Number(page),
      stats: statsObject,
    };
  }

  static async retrySms(smsLogIds: number[]) {
    if (!smsLogIds || !Array.isArray(smsLogIds)) {
      return {
        status: 400,
        body: { error: "Invalid SMS log IDs format" },
      };
    }

    const apiKey = process.env.BULK_SMS_API_KEY;
    const senderId = process.env.BULK_SMS_SENDER_ID;

    if (!apiKey) {
      return {
        status: 400,
        body: { error: "SMS API key not configured" },
      };
    }

    let successCount = 0;
    let failedCount = 0;
    const results: any[] = [];
    const smsMessages: any[] = [];
    const smsLogMap = new Map<string, any[]>();

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

        smsMessages.push({
          Number: `88${smsLog.phone_number}`,
          Text: smsLog.message,
        });

        const phoneKey = `88${smsLog.phone_number}`;
        if (!smsLogMap.has(phoneKey)) {
          smsLogMap.set(phoneKey, []);
        }
        smsLogMap.get(phoneKey)?.push({
          smsLogId: smsLogId,
          smsLog: smsLog,
        });
      } catch (error: any) {
        results.push({
          smsLogId,
          status: "failed",
          message: error.message,
        });
        failedCount++;
      }
    }

    if (smsMessages.length > 0) {
      try {
        const bulkSmsResponse = await sendBulkSMS(
          smsMessages,
          apiKey,
          senderId as string,
        );

        if (bulkSmsResponse && bulkSmsResponse.results) {
          for (const result of bulkSmsResponse.results) {
            const smsDataArray = smsLogMap.get(result.to);
            if (smsDataArray) {
              if (result.status === "sent") {
                successCount++;

                for (const smsData of smsDataArray) {
                  const { smsLogId, smsLog } = smsData;

                  await prisma.sms_logs.update({
                    where: { id: smsLogId },
                    data: {
                      status: "sent",
                      sms_count: result.sms_count || 1,
                      message_id: result.message_id,
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
                }
              } else {
                failedCount++;

                for (const smsData of smsDataArray) {
                  const { smsLogId, smsLog } = smsData;

                  await prisma.sms_logs.update({
                    where: { id: smsLogId },
                    data: {
                      status: "failed",
                      error_reason: `API Error: ${result.code || "Unknown error"}`,
                      updated_at: new Date(),
                    },
                  });

                  results.push({
                    smsLogId,
                    status: "failed",
                    message: `API Error: ${result.code || "Unknown error"}`,
                    studentName: smsLog.student.name,
                  });
                }
              }
            }
          }
        } else {
          for (const [_phoneNumber, smsDataArray] of smsLogMap) {
            failedCount++;
            for (const smsData of smsDataArray) {
              const { smsLogId, smsLog } = smsData;
              await prisma.sms_logs.update({
                where: { id: smsLogId },
                data: {
                  status: "failed",
                  error_reason: "Invalid bulk SMS response",
                  updated_at: new Date(),
                },
              });

              results.push({
                smsLogId,
                status: "failed",
                message: "Invalid bulk SMS response",
                studentName: smsLog.student.name,
              });
            }
          }
        }
      } catch (smsError: any) {
        for (const [_phoneNumber, smsDataArray] of smsLogMap) {
          failedCount++;

          for (const smsData of smsDataArray) {
            const { smsLogId, smsLog } = smsData;
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
              studentName: smsLog.student.name,
            });
          }
        }
      }
    }

    return {
      status: 200,
      body: {
        message: `Retry completed: ${successCount} successful, ${failedCount} failed`,
        results,
        stats: {
          total: smsLogIds.length,
          successful: successCount,
          failed: failedCount,
        },
      },
    };
  }

  static async deleteSmsLogs(smsLogIds: number[]) {
    if (!smsLogIds || !Array.isArray(smsLogIds)) {
      return {
        status: 400,
        body: { error: "Invalid SMS log IDs format" },
      };
    }

    const deletedCount = await prisma.sms_logs.deleteMany({
      where: {
        id: { in: smsLogIds },
      },
    });

    return {
      status: 200,
      body: {
        message: `${deletedCount.count} SMS logs deleted successfully`,
        deletedCount: deletedCount.count,
      },
    };
  }

  static async getSmsStats(filters: StatsFilters, user?: UserContext) {
    const { startDate, endDate } = filters;
    const whereClause: any = {};

    if (startDate && endDate) {
      whereClause.attendance_date = {
        gte: startDate,
        lte: endDate,
      };
    }

    const studentFilter = await buildTeacherStudentFilter(user);
    if (studentFilter) {
      whereClause.student_id = studentFilter;
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

    const statusStatsObject = statusStats.reduce((acc: any, stat) => {
      acc[stat.status] = stat._count.status;
      return acc;
    }, {});

    return {
      statusStats: statusStatsObject,
      dailyStats,
      retryStats,
    };
  }
}
