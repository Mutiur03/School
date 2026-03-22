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
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);
      where.date = {
        gte: startDate.toISOString().split("T")[0],
        lte: endDate.toISOString().split("T")[0],
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
    const today = new Date().toLocaleDateString("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Dhaka",
    });

    const smsSettings = await SmsSettingsService.getSettings();
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

    let smsSuccessCount = 0;
    let smsFailedCount = 0;
    let smsPendingCount = 0;
    const smsMessages: any[] = [];
    const smsLogMap = new Map<string, SmsLogInfo[]>();

    const result = await prisma.$transaction(async (tx) => {
      const innerProcessed: { studentId: number; date: string; status: string }[] =
        [];
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

        const shouldSendPresent =
          status === "present" && smsSettings.send_to_present;
        const shouldSendAbsent =
          status === "absent" && smsSettings.send_to_absent;

        if (
          formattedDate === today &&
          (shouldSendPresent || shouldSendAbsent) &&
          smsSettings.is_active
        ) {
          const student = await tx.students.findUnique({
            where: { id: studentId },
            select: {
              id: true,
              name: true,
              login_id: true,
              father_phone: true,
              enrollments: {
                where: {
                  year: parseInt(formattedDate.split("-")[0]),
                },
                take: 1,
              },
            },
          });

          if (student?.father_phone) {
            const hasSent = await tx.attendence.findFirst({
              where: { student_id: studentId, date: formattedDate },
              select: { send_msg: true },
            });

            if (!hasSent?.send_msg) {
              const template =
                status === "present"
                  ? smsSettings.present_template
                  : smsSettings.absent_template;
              const enrollment = student.enrollments?.[0];

              const message = interpolate(template, {
                student_name: student.name,
                login_id: student.login_id.toString(),
                date: formattedDate,
                class: enrollment?.class?.toString() || "N/A",
                section: enrollment?.section || "N/A",
                roll: enrollment?.roll?.toString() || "N/A",
              });
              const smsCount = SMSService.calculateSMSCount(message).count;

              const smsLog = await tx.sms_logs.create({
                data: {
                  student_id: studentId,
                  phone_number: student.father_phone,
                  message: message,
                  attendance_date: formattedDate,
                  status: "pending",
                  sms_count: smsCount,
                },
              });

              const phoneKey = SMSService.formatPhoneNumber(student.father_phone);
              if (!smsLogMap.has(phoneKey)) smsLogMap.set(phoneKey, []);
              smsLogMap.get(phoneKey)!.push({
                smsLogId: smsLog.id,
                studentId,
                attendanceDate: formattedDate,
                studentName: student.name,
              });

              smsMessages.push({ Number: phoneKey, Text: message });
            }
          }
        }
      }
      return {
        processed: innerProcessed,
        absentCount: innerAbsentCount,
        presentCount: innerPresentCount,
      };
    });

    const { processed, absentCount, presentCount } = result;

    if (smsMessages.length > 0) {
      const settings = await SMSService.getSettings();
      let totalSegmentsNeeded = 0;
      for (const msg of smsMessages) {
        totalSegmentsNeeded += SMSService.calculateSMSCount(msg.Text).count;
      }

      if (settings.sms_balance < totalSegmentsNeeded) {
        // Insufficient balance, leave as pending
        smsPendingCount = smsMessages.length;
      } else {
        try {
          const bulkSmsResponse = await SMSService.sendBulkSMS(smsMessages);
          if (bulkSmsResponse.success && bulkSmsResponse.data?.results) {
            const processRes = await SmsLogsService.processBatchResults(
              bulkSmsResponse.data.results,
              smsLogMap
            );
            smsSuccessCount = processRes.successCount;
            smsFailedCount = processRes.failedCount;
            // Any that didn't go through are considered pending if they were successfully processed
            smsPendingCount = smsMessages.length - (smsSuccessCount + smsFailedCount);
          } else {
            const failRes = await SmsLogsService.handleCatastrophicFailure(
              smsLogMap,
              bulkSmsResponse.message || "Bulk SMS delivery failed"
            );
            smsFailedCount = failRes.failedCount;
            // If the failure reason is balance, it would be caught by the pre-check above,
            // but if it somehow gets here, we mark as failed per current handleCatastrophicFailure logic.
          }
        } catch (smsErr: any) {
          const failRes = await SmsLogsService.handleCatastrophicFailure(
            smsLogMap,
            smsErr.message || "Unknown SMS Error"
          );
          smsFailedCount = failRes.failedCount;
        }
      }
    }



    return {
      processed: processed.length,
      present: presentCount,
      absent: absentCount,
      sms: {
        successful: smsSuccessCount,
        failed: smsFailedCount,
        pending: smsPendingCount,
      },
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
      { present: 0, absent: 0 }
    );

    const smsSummary = smsLogsStats.reduce(
      (acc: any, curr) => {
        acc[curr.status] = curr._count.status;
        return acc;
      },
      { sent: 0, failed: 0, pending: 0 }
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
