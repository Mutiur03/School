import { prisma } from "@/config/prisma.js";
import { SMSService } from "@/utils/sms.service.js";
import { SmsSettingsService } from "../sms-settings/sms-settings.service.js";
import { SmsLogsService, SmsLogInfo } from "../sms-logs/sms-logs.service.js";

export class AttendenceService {
  static async getAllAttendence(filters: {
    month?: number;
    year?: number;
    level?: number;
    section?: string;
  }) {
    const { month, year, level, section } = filters;

    const where: any = {};

    if (year !== undefined && month !== undefined) {
      const startDayString = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endDayString = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      where.date = {
        gte: startDayString,
        lte: endDayString,
      };
    } else if (year !== undefined) {
      where.date = {
        startsWith: `${year}-`,
      };
    }

    if (level !== undefined || section !== undefined) {
      where.student = {
        enrollments: {
          some: {
            class: level,
            section: section,
            year: year,
          },
        },
      };
    }

    return await prisma.attendence.findMany({
      where,
      orderBy: { date: "desc" },
    });
  }

  static async addAttendence(records: any[]) {
    const result = await prisma.$transaction(async (tx) => {
      const innerProcessed: {
        studentId: number;
        date: string;
        status: string;
      }[] = [];
      let innerAbsentCount = 0;
      let innerPresentCount = 0;

      for (const record of records) {
        let { studentId, date, status } = record;
        const formattedDate = new Date(date).toLocaleDateString("en-CA", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          timeZone: "Asia/Dhaka",
        });

        const existingRecord = await tx.attendence.findFirst({
          where: { student_id: studentId, date: formattedDate },
        });

        if (existingRecord) {
          await tx.attendence.update({
            where: { id: existingRecord.id },
            data: { status },
          });
        } else {
          await tx.attendence.create({
            data: { student_id: studentId, date: formattedDate, status },
          });
        }

        innerProcessed.push({ studentId, date: formattedDate, status });
        if (status === "absent") innerAbsentCount++;
        else if (status === "present") innerPresentCount++;
      }
      return {
        processed: innerProcessed,
        absentCount: innerAbsentCount,
        presentCount: innerPresentCount,
      };
    });

    const { processed, absentCount, presentCount } = result;

    return {
      processed: processed.length,
      present: presentCount,
      absent: absentCount,
      // sms: { successful: 0, failed: 0, pending: 0 },
    };
  }

  static async sendAttendanceSMS(filters: {
    date: string;
    level: number;
    section: string;
    year: number;
  }) {
    const { date, level, section, year } = filters;

    const smsSettings = await SmsSettingsService.getSettings();
    if (!smsSettings.is_active) {
      throw new Error("SMS service is currently disabled in settings.");
    }

    const SCHOOL_NAME = "Panchbibi Lal Bihari Pilot Govt. High School";

    const interpolate = (template: string, data: any) => {
      return template
        .replace(/{student_name}/g, data.student_name || "")
        .replace(/{login_id}/g, data.login_id || "")
        .replace(/{date}/g, data.date || "")
        .replace(/{class}/g, data.class || "")
        .replace(/{section}/g, data.section || "")
        .replace(/{roll}/g, data.roll || "")
        .replace(/{school_name}/g, SCHOOL_NAME);
    };

    const enrollments = await prisma.student_enrollments.findMany({
      where: { 
        class: level, 
        section, 
        year,
        student: { available: true }
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            login_id: true,
            father_phone: true,
          },
        },
      },
    });

    if (enrollments.length === 0) {
      throw new Error("No students found for the selected class and section.");
    }

    const studentIds = enrollments.map((e) => e.student_id);

    const attendanceRecords = await prisma.attendence.findMany({
      where: {
        date,
        student_id: { in: studentIds },
        send_msg: false,
      },
    });

    if (attendanceRecords.length === 0) {
      return { message: "No pending attendance SMS to send for this date." };
    }

    const recordsMap = new Map(attendanceRecords.map((r) => [r.student_id, r]));
    const smsMessages: any[] = [];
    const smsLogMap = new Map<string, SmsLogInfo[]>();
    let totalSegmentsNeeded = 0;

    for (const enrollment of enrollments) {
      const attendance = recordsMap.get(enrollment.student_id);
      if (!attendance) continue;

      const { status } = attendance;
      const shouldSendPresent =
        status === "present" && smsSettings.send_to_present;
      const shouldSendAbsent =
        status === "absent" && smsSettings.send_to_absent;

      if (
        (shouldSendPresent || shouldSendAbsent) &&
        enrollment.student.father_phone
      ) {
        const template =
          status === "present"
            ? smsSettings.present_template
            : smsSettings.absent_template;

        const message = interpolate(template, {
          student_name: enrollment.student.name,
          login_id: enrollment.student.login_id.toString(),
          date,
          class: enrollment.class.toString(),
          section: enrollment.section,
          roll: enrollment.roll.toString(),
        });

        const smsCount = SMSService.calculateSMSCount(message).count;
        totalSegmentsNeeded += smsCount;

        const smsLog = await prisma.sms_logs.create({
          data: {
            student_id: enrollment.student_id,
            phone_number: enrollment.student.father_phone,
            message: message,
            attendance_date: date,
            status: "pending",
            sms_count: smsCount,
          },
        });

        const phoneKey = SMSService.formatPhoneNumber(
          enrollment.student.father_phone,
        );
        if (!smsLogMap.has(phoneKey)) smsLogMap.set(phoneKey, []);
        smsLogMap.get(phoneKey)!.push({
          smsLogId: smsLog.id,
          studentId: enrollment.student_id,
          attendanceDate: date,
          studentName: enrollment.student.name,
        });

        smsMessages.push({ Number: phoneKey, Text: message });
      }
    }

    if (smsMessages.length === 0) {
      return { message: "No messages to send based on current SMS settings." };
    }

    const isReserved =
      await SmsSettingsService.reserveBalance(totalSegmentsNeeded);
    if (!isReserved) {
      throw new Error("Insufficient SMS balance.");
    }

    let smsSuccessCount = 0;
    let smsFailedCount = 0;

    try {
      const bulkSmsResponse = await SMSService.sendBulkSMS(smsMessages, { skipBalanceUpdate: true });
      if (bulkSmsResponse.success && bulkSmsResponse.data?.results) {
        const processRes = await SmsLogsService.processBatchResults(
          bulkSmsResponse.data.results,
          smsLogMap,
        );
        smsSuccessCount = processRes.successCount;
        smsFailedCount = processRes.failedCount;

        const sentStudentIds = Array.from(smsLogMap.values())
          .flat()
          .map((info) => info.studentId);

        await prisma.attendence.updateMany({
          where: {
            date,
            student_id: { in: sentStudentIds },
          },
          data: { send_msg: true },
        });

        let totalActualUsed = 0;
        for (const res of bulkSmsResponse.data.results) {
          totalActualUsed += res.sms_count || 1;
        }
        const refund = totalSegmentsNeeded - totalActualUsed;
        if (refund > 0) {
          await SmsSettingsService.updateBalance(refund);
        }
      } else {
        await SmsSettingsService.updateBalance(totalSegmentsNeeded);
        await SmsLogsService.handleCatastrophicFailure(
          smsLogMap,
          bulkSmsResponse.message || "Bulk SMS delivery failed",
        );
        throw new Error(bulkSmsResponse.message || "Failed to send SMS");
      }
    } catch (error: any) {
      await SmsSettingsService.updateBalance(totalSegmentsNeeded);
      await SmsLogsService.handleCatastrophicFailure(
        smsLogMap,
        error.message || "Unknown SMS Error",
      );
      throw error;
    }

    return {
      successful: smsSuccessCount,
      failed: smsFailedCount,
      total: smsMessages.length,
    };
  }

  static async getAttendanceStats(filters: {
    date: string;
    level: number;
    section: string;
    year: number;
  }) {
    const { date, level, section, year } = filters;

    const studentsInLevel = await prisma.student_enrollments.findMany({
      where: {
        class: level,
        section: section,
        year: year,
      },
      select: { student_id: true },
    });

    const studentIds = studentsInLevel.map((s) => s.student_id);

    const [attendanceStats, smsLogsStats] = await Promise.all([
      prisma.attendence.groupBy({
        by: ["status"],
        where: {
          date: date,
          student_id: { in: studentIds },
        },
        _count: { status: true },
      }),
      prisma.sms_logs.groupBy({
        by: ["status"],
        where: {
          attendance_date: date,
          student_id: { in: studentIds },
        },
        _count: { status: true },
      }),
    ]);

    const attendanceSummary = attendanceStats.reduce(
      (acc: any, curr) => {
        acc[curr.status] = curr._count.status;
        return acc;
      },
      { present: 0, absent: 0 },
    );

    const smsSummary = smsLogsStats.reduce(
      (acc: any, curr) => {
        acc[curr.status] = curr._count.status;
        return acc;
      },
      { sent: 0, failed: 0, pending: 0 },
    );

    return {
      present: attendanceSummary.present,
      absent: attendanceSummary.absent,
      sms: {
        successful: smsSummary.sent,
        failed: smsSummary.failed,
        pending: smsSummary.pending,
      },
    };
  }
}
