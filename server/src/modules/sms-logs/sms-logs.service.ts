import { prisma } from "@/config/prisma.js";
import { SMSService } from "@/utils/sms.service.js";
import { SmsSettingsService } from "../sms-settings/sms-settings.service.js";

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

export type SmsLogInfo = {
  smsLogId: number;
  studentId: number;
  attendanceDate: string;
  studentName?: string;
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

  static async processBatchResults(
    batchResults: any[],
    smsLogMap: Map<string, SmsLogInfo[]>,
  ) {
    let successCount = 0;
    let failedCount = 0;
    const results: any[] = [];

    for (const result of batchResults) {
      const smsDataArray = smsLogMap.get(result.to);
      if (smsDataArray) {
        for (const smsData of smsDataArray) {
          const { smsLogId, studentId, attendanceDate, studentName } = smsData;

          if (result.status === "sent") {
            successCount++;

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
                student_id: studentId,
                date: attendanceDate,
              },
              data: { send_msg: true },
            });

            results.push({
              smsLogId,
              status: "success",
              message: "SMS sent successfully",
              studentName,
            });
          } else {
            failedCount++;

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
              studentName,
            });
          }
        }
      }
    }
    return { successCount, failedCount, results };
  }

  static async handleCatastrophicFailure(
    smsLogMap: Map<string, SmsLogInfo[]>,
    errorReason: string,
  ) {
    let failedCount = 0;
    const results: any[] = [];

    for (const [_phoneNumber, smsDataArray] of smsLogMap) {
      for (const smsData of smsDataArray) {
        const { smsLogId, studentName } = smsData;
        failedCount++;

        await prisma.sms_logs.update({
          where: { id: smsLogId },
          data: {
            status: "failed",
            error_reason: errorReason,
            updated_at: new Date(),
          },
        });

        results.push({
          smsLogId,
          status: "failed",
          message: errorReason,
          studentName,
        });
      }
    }
    return { failedCount, results };
  }

  static async retrySms(smsLogIds: number[]) {
    if (!smsLogIds || !Array.isArray(smsLogIds)) {
      return {
        status: 400,
        body: { error: "Invalid SMS log IDs format" },
      };
    }

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const results: any[] = [];
    const smsMessages: { Number: string; Text: string }[] = [];
    const smsLogMap = new Map<string, SmsLogInfo[]>();

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
            studentName: smsLog.student.name,
          });
          skippedCount++;
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

        const phoneNumber = smsLog.phone_number.startsWith("88")
          ? smsLog.phone_number
          : `88${smsLog.phone_number}`;

        smsMessages.push({
          Number: phoneNumber,
          Text: smsLog.message,
        });

        if (!smsLogMap.has(phoneNumber)) {
          smsLogMap.set(phoneNumber, []);
        }
        smsLogMap.get(phoneNumber)!.push({
          smsLogId: smsLogId,
          studentId: smsLog.student_id,
          attendanceDate: smsLog.attendance_date,
          studentName: smsLog.student.name,
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
      let totalSegmentsNeeded = 0;
      for (const msg of smsMessages) {
        totalSegmentsNeeded += SMSService.calculateSMSCount(msg.Text).count;
      }

      // Reserve balance atomically
      const isReserved = await SmsSettingsService.reserveBalance(totalSegmentsNeeded);

      if (!isReserved) {
        results.push({
          status: "error",
          message: "Insufficient SMS balance for retry",
        });
        failedCount += smsMessages.length;
      } else {
        try {
          const bulkSmsResponse = await SMSService.sendBulkSMS(smsMessages);

          if (bulkSmsResponse.success && bulkSmsResponse.data?.results) {
            const processRes = await this.processBatchResults(
              bulkSmsResponse.data.results,
              smsLogMap,
            );
            successCount += processRes.successCount;
            failedCount += processRes.failedCount;
            results.push(...processRes.results);

            // Calculate actual usage and refund unused portion
            let totalActualUsed = 0;
            for (const res of bulkSmsResponse.data.results) {
              totalActualUsed += (res.sms_count || 1);
            }
            const refund = totalSegmentsNeeded - totalActualUsed;
            if (refund > 0) {
              await SmsSettingsService.updateBalance(refund);
            }
          } else {
            // Catastrophic failure - refund entire reserved amount
            await SmsSettingsService.updateBalance(totalSegmentsNeeded);
            const errorReason = bulkSmsResponse.message || "Bulk SMS delivery failed";
            const failRes = await this.handleCatastrophicFailure(
              smsLogMap,
              errorReason,
            );
            failedCount += failRes.failedCount;
            results.push(...failRes.results);
          }
        } catch (smsError: any) {
          // Refund entire reserved amount on error
          await SmsSettingsService.updateBalance(totalSegmentsNeeded);
          const failRes = await this.handleCatastrophicFailure(
            smsLogMap,
            smsError.message,
          );
          failedCount += failRes.failedCount;
          results.push(...failRes.results);
        }
      }
    }

    return {
      status: 200,
      body: {
        message: `Retry completed: ${successCount} successful, ${failedCount} failed, ${skippedCount} skipped`,
        results,
        stats: {
          total: smsLogIds.length,
          successful: successCount,
          failed: failedCount,
          skipped: skippedCount,
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

  static async getSmsUsageStats(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await prisma.sms_logs.findMany({
      where: {
        status: "sent",
        created_at: {
          gte: startDate,
        },
      },
      select: {
        sms_count: true,
        created_at: true,
      },
      orderBy: {
        created_at: "asc",
      },
    });

    const usageMap = new Map<string, number>();

    // Initialize all days in range with 0
    for (let i = 0; i <= days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split("T")[0];
      usageMap.set(dateKey, 0);
    }

    // Fill with actual data
    logs.forEach((log) => {
      const dateKey = log.created_at.toISOString().split("T")[0];
      if (usageMap.has(dateKey)) {
        usageMap.set(dateKey, usageMap.get(dateKey)! + (log.sms_count || 1));
      }
    });

    const stats = Array.from(usageMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      status: 200,
      body: { stats },
    };
  }
}
