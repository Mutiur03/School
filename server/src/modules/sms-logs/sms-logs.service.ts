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

type ProcessBatchOptions = {
  updateAttendance?: boolean;
};

export type SmsLogInfo = {
  smsLogId: number;
  studentId: number;
  attendanceDate: string;
  studentName?: string;
};

const getLocalDateKey = (date: Date = new Date()): string =>
  date.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });

const getBulkResults = (data: any): any[] | null => {
  if (!Array.isArray(data?.results) || data.results.length === 0) {
    return null;
  }
  return data.results;
};

const isSmsResultSuccessful = (result: any): boolean => {
  const status = String(result?.status ?? "").toLowerCase();
  return status === "sent" || status === "success" || status === "delivered";
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

const finalizeBulkSend = async (
  bulkSmsResponse: { success: boolean; data?: any; message?: string },
  orderedBatches: SmsLogInfo[][],
  totalSegmentsNeeded: number,
  options?: ProcessBatchOptions,
) => {
  const processRes = await SmsLogsService.applyBulkSmsResponse(
    bulkSmsResponse,
    orderedBatches,
    options,
  );

  if (!processRes.delivered) {
    await SmsSettingsService.updateBalance(totalSegmentsNeeded);
    return processRes;
  }

  let totalActualUsed = 0;
  for (const res of processRes.batchResults ?? []) {
    totalActualUsed += res.sms_count || 1;
  }
  const refund = totalSegmentsNeeded - totalActualUsed;
  if (refund > 0) {
    await SmsSettingsService.updateBalance(refund);
  }

  return processRes;
};

export class SmsLogsService {
  static async getSmsLogs(filters: LogFilters, user?: UserContext) {
    const { status, date, page = 1, limit = 50 } = filters;
    const safePage = Math.max(1, Number.isFinite(page) ? Number(page) : 1);
    const safeLimit = Math.min(
      100,
      Math.max(1, Number.isFinite(limit) ? Number(limit) : 50),
    );
    const offset = (safePage - 1) * safeLimit;

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
        skip: offset,
        take: safeLimit,
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
      totalPages: Math.ceil(totalCount / safeLimit),
      currentPage: safePage,
      stats: statsObject,
    };
  }

  /**
   * Match results by index — result[i] corresponds to orderedBatches[i].
   * This avoids relying on result.to which is not returned by the SMS API.
   */
  static async processBatchResults(
    batchResults: any[],
    orderedBatches: SmsLogInfo[][],
    options?: ProcessBatchOptions,
  ) {
    const updateAttendance = options?.updateAttendance ?? false;
    let successCount = 0;
    let failedCount = 0;
    const results: any[] = [];

    const pairedCount = Math.min(batchResults.length, orderedBatches.length);

    for (let i = 0; i < pairedCount; i++) {
      const result = batchResults[i];
      const smsDataArray = orderedBatches[i];

      for (let j = 0; j < smsDataArray.length; j++) {
        const smsData = smsDataArray[j];
        const { smsLogId, studentId, attendanceDate, studentName } = smsData;
        // Only the first log in a deduped batch carries billable segments
        const billedSegments = j === 0 ? result.sms_count || 1 : 0;

        if (isSmsResultSuccessful(result)) {
          successCount++;

          await prisma.sms_logs.update({
            where: { id: smsLogId },
            data: {
              status: "sent",
              sms_count: billedSegments,
              message_id: result.message_id,
              error_reason: null,
              updated_at: new Date(),
            },
          });

          if (updateAttendance) {
            await prisma.attendence.updateMany({
              where: {
                student_id: studentId,
                date: attendanceDate,
              },
              data: { send_msg: true },
            });
          }

          results.push({
            smsLogId,
            status: "success",
            message: "SMS sent successfully",
            studentName,
          });
        } else {
          failedCount++;
          const errorReason = `API Error: ${
            result?.code || result?.status || "Unknown error"
          }`;

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
    }

    for (let i = pairedCount; i < orderedBatches.length; i++) {
      for (const smsData of orderedBatches[i]) {
        const { smsLogId, studentName } = smsData;
        failedCount++;
        const errorReason = "No matching API result returned";

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

    return { successCount, failedCount, results };
  }

  static async applyBulkSmsResponse(
    bulkSmsResponse: { success: boolean; data?: any; message?: string },
    orderedBatches: SmsLogInfo[][],
    options?: ProcessBatchOptions,
  ) {
    const batchResults = bulkSmsResponse.success
      ? getBulkResults(bulkSmsResponse.data)
      : null;

    if (!batchResults) {
      const errorReason = bulkSmsResponse.message || "Bulk SMS delivery failed";
      const failRes = await this.handleCatastrophicFailure(
        orderedBatches,
        errorReason,
      );
      return {
        successCount: 0,
        failedCount: failRes.failedCount,
        results: failRes.results,
        delivered: false as const,
      };
    }

    const processRes = await this.processBatchResults(
      batchResults,
      orderedBatches,
      options,
    );
    return {
      ...processRes,
      delivered: true as const,
      batchResults,
    };
  }

  static async handleCatastrophicFailure(
    orderedBatches: SmsLogInfo[][],
    errorReason: string,
  ) {
    let failedCount = 0;
    const results: any[] = [];

    for (const smsDataArray of orderedBatches) {
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
    const orderedBatches: SmsLogInfo[][] = [];

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

        const phoneNumber = SMSService.formatPhoneNumber(smsLog.phone_number);

        smsMessages.push({ Number: phoneNumber, Text: smsLog.message });
        orderedBatches.push([{
          smsLogId,
          studentId: smsLog.student_id,
          attendanceDate: smsLog.attendance_date,
          studentName: smsLog.student.name,
        }]);
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

      const isReserved = await SmsSettingsService.reserveBalance(totalSegmentsNeeded);

      if (!isReserved) {
        const errorReason = "Insufficient SMS balance";
        for (const batch of orderedBatches) {
          for (const { smsLogId, studentName } of batch) {
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
            failedCount++;
          }
        }
      } else {
        try {
          const bulkSmsResponse = await SMSService.sendBulkSMS(smsMessages, {
            skipBalanceUpdate: true,
          });
          const processRes = await finalizeBulkSend(
            bulkSmsResponse,
            orderedBatches,
            totalSegmentsNeeded,
          );
          successCount += processRes.successCount;
          failedCount += processRes.failedCount;
          results.push(...processRes.results);
        } catch (smsError: any) {
          await SmsSettingsService.updateBalance(totalSegmentsNeeded);
          const failRes = await this.handleCatastrophicFailure(
            orderedBatches,
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
    const safeDays = Math.min(
      365,
      Math.max(1, Number.isFinite(days) ? Math.floor(days) : 30),
    );
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - safeDays);

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

    for (let i = 0; i <= safeDays; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      usageMap.set(getLocalDateKey(d), 0);
    }

    logs.forEach((log) => {
      const dateKey = getLocalDateKey(log.created_at);
      if (usageMap.has(dateKey)) {
        usageMap.set(dateKey, usageMap.get(dateKey)! + (log.sms_count ?? 1));
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
    const classPhones = new Map<number, Set<string>>();
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
          if (!classPhones.has(e.class)) {
            classPhones.set(e.class, new Set());
          }
          classPhones.get(e.class)!.add(formatted);
        }
      }
    }

    for (const [classNum, phones] of classPhones) {
      if (classBreakdown[classNum]) {
        classBreakdown[classNum].withPhone = phones.size;
      }
    }

    return {
      totalStudents: enrollments.length,
      withPhone: uniqueGlobalPhones.size,
      classBreakdown,
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
    const orderedBatches: SmsLogInfo[][] = [];
    // Track deduped phones so same phone → same index in smsMessages
    const phoneIndexMap = new Map<string, number>();
    const todayStr = getLocalDateKey();
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
          message,
          attendance_date: todayStr,
          status: "pending",
          sms_count: smsCountPerMsg,
        },
      });

      if (!phoneIndexMap.has(formattedPhone)) {
        phoneIndexMap.set(formattedPhone, smsMessages.length);
        smsMessages.push({ Number: formattedPhone, Text: message });
        orderedBatches.push([]);
        totalSegmentsNeeded += smsCountPerMsg;
      }

      const idx = phoneIndexMap.get(formattedPhone)!;
      orderedBatches[idx].push({
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
      const logIds = orderedBatches.flat().map((l) => l.smsLogId);
      await prisma.sms_logs.deleteMany({ where: { id: { in: logIds } } });
      throw new Error("Insufficient SMS balance.");
    }

    try {
      const bulkSmsResponse = await SMSService.sendBulkSMS(smsMessages, {
        skipBalanceUpdate: true,
      });
      return await finalizeBulkSend(
        bulkSmsResponse,
        orderedBatches,
        totalSegmentsNeeded,
      );
    } catch (error: any) {
      await SmsSettingsService.updateBalance(totalSegmentsNeeded);
      return await this.handleCatastrophicFailure(
        orderedBatches,
        error.message || "Unknown SMS Error",
      );
    }
  }
}
