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

  static async getStudentCountByClasses(classNames: number[]) {
    if (!classNames || classNames.length === 0) return { totalStudents: 0, withPhone: 0, classBreakdown: {} };

    const currentYear = new Date().getFullYear();
    const enrollments = await prisma.student_enrollments.findMany({
      where: {
        year: currentYear,
        class: { in: classNames },
        student: { available: true },
      },
      include: {
        student: {
          select: {
            father_phone: true,
            mother_phone: true,
          },
        },
      },
    });

    const uniqueGlobalPhones = new Set<string>();
    const classBreakdown: Record<number, { total: number; withPhone: number }> = {};

    for (const e of enrollments) {
      if (!classBreakdown[e.class]) {
        classBreakdown[e.class] = { total: 0, withPhone: 0 };
      }
      classBreakdown[e.class].total++;

      const fPhone = (e.student.father_phone || "").trim();
      const mPhone = (e.student.mother_phone || "").trim();
      const phone = fPhone || mPhone;
      
      if (phone) {
        const formatted = SMSService.formatPhoneNumber(phone);
        if (formatted && formatted.length >= 10) {
          uniqueGlobalPhones.add(formatted);
          // Note: withPhone in breakdown is simple count of students who HAVE a phone
          classBreakdown[e.class].withPhone++;
        }
      }
    }

    return { 
      totalStudents: enrollments.length, 
      withPhone: uniqueGlobalPhones.size, 
      classBreakdown 
    };
  }

  static async sendBulkSmsByClass(classNames: number[], message: string) {
    if (!classNames || !Array.isArray(classNames) || classNames.length === 0) {
      throw new Error("Please select at least one class.");
    }
    if (!message || message.trim().length === 0) {
      throw new Error("Message content cannot be empty.");
    }

    const currentYear = new Date().getFullYear();
    const where: any = {
      year: currentYear,
      class: { in: classNames },
      student: { available: true },
    };

    const enrollments = await prisma.student_enrollments.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            father_phone: true,
            mother_phone: true,
          },
        },
      },
    });

    if (enrollments.length === 0) {
      throw new Error("No students found in the selected classes.");
    }

    const smsMessages: { Number: string; Text: string }[] = [];
    const smsLogMap = new Map<string, SmsLogInfo[]>();
    const todayStr = new Date().toISOString().split("T")[0];
    let totalSegmentsNeeded = 0;

    const smsCountPerMsg = SMSService.calculateSMSCount(message).count;

    for (const enrollment of enrollments) {
      const fPhone = (enrollment.student.father_phone || "").trim();
      const mPhone = (enrollment.student.mother_phone || "").trim();
      const phone = fPhone || mPhone;
      
      if (!phone) continue;

      const formattedPhone = SMSService.formatPhoneNumber(phone);
      if (!formattedPhone || formattedPhone.length < 10) continue;
      
      const smsLog = await prisma.sms_logs.create({
        data: {
          student_id: enrollment.student_id,
          phone_number: phone,
          message: message,
          attendance_date: todayStr,
          status: "pending",
          sms_count: smsCountPerMsg,
        },
      });

      if (!smsLogMap.has(formattedPhone)) {
        smsLogMap.set(formattedPhone, []);
        smsMessages.push({ Number: formattedPhone, Text: message });
        totalSegmentsNeeded += smsCountPerMsg;
      }
      
      smsLogMap.get(formattedPhone)!.push({
        smsLogId: smsLog.id,
        studentId: enrollment.student_id,
        attendanceDate: todayStr,
        studentName: enrollment.student.name,
      });
    }

    if (smsMessages.length === 0) {
      throw new Error("No valid phone numbers found for the selected students.");
    }

    const isReserved = await SmsSettingsService.reserveBalance(totalSegmentsNeeded);
    if (!isReserved) {
      // Cleanup pending logs
      const logIds = Array.from(smsLogMap.values()).flat().map(l => l.smsLogId);
      await prisma.sms_logs.deleteMany({ where: { id: { in: logIds } } });
      throw new Error("Insufficient SMS balance.");
    }

    try {
      const bulkSmsResponse = await SMSService.sendBulkSMS(smsMessages, { skipBalanceUpdate: true });
      
      if (bulkSmsResponse.success && bulkSmsResponse.data?.results) {
        const processRes = await this.processBatchResults(bulkSmsResponse.data.results, smsLogMap);
        
        let totalActualUsed = 0;
        for (const res of bulkSmsResponse.data.results) {
          totalActualUsed += (res.sms_count || 1);
        }
        const refund = totalSegmentsNeeded - totalActualUsed;
        if (refund > 0) {
          await SmsSettingsService.updateBalance(refund);
        }
        return processRes;
      } else {
        await SmsSettingsService.updateBalance(totalSegmentsNeeded);
        const errorReason = bulkSmsResponse.message || "Bulk SMS delivery failed";
        const failRes = await this.handleCatastrophicFailure(smsLogMap, errorReason);
        return failRes;
      }
    } catch (error: any) {
      await SmsSettingsService.updateBalance(totalSegmentsNeeded);
      const failRes = await this.handleCatastrophicFailure(smsLogMap, error.message || "Unknown SMS Error");
      return failRes;
    }
  }
}
