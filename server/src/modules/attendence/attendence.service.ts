import { prisma } from "@/config/prisma.js";
import { SMSService } from "@/utils/sms.service.js";

export class AttendenceService {
  static async getAllAttendence(filters: { month?: number; year?: number; level?: number; section?: string }) {
    const { month, year, level, section } = filters;
    
    const where: any = {};
    
    if (year !== undefined && month !== undefined) {
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);
      where.date = {
        gte: startDate.toISOString().split('T')[0],
        lte: endDate.toISOString().split('T')[0],
      };
    } else if (year !== undefined) {
        where.date = {
            startsWith: `${year}-`
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

    const processed = [];
    const errors = [];
    let smsSuccessCount = 0;
    let smsFailedCount = 0;
    let absentCount = 0;
    let presentCount = 0;
    const smsMessages: any[] = [];
    const smsLogMap = new Map();

    for (const record of records) {
      let { studentId, date, status } = record;
      const formattedDate = new Date(date).toLocaleDateString("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Asia/Dhaka",
      });

      try {
        const existingRecord = await prisma.attendence.findFirst({
          where: { student_id: studentId, date: formattedDate },
        });

        if (existingRecord) {
          await prisma.attendence.update({
            where: { id: existingRecord.id },
            data: { status },
          });
        } else {
          await prisma.attendence.create({
            data: { student_id: studentId, date: formattedDate, status },
          });
        }

        processed.push({ studentId, date: formattedDate, status });
        if (status === "absent") absentCount++;
        else if (status === "present") presentCount++;

        // SMS Logic for present students today
        if (formattedDate === today && status === "present") {
          const student = await prisma.students.findUnique({
            where: { id: studentId },
            select: { id: true, name: true, login_id: true, father_phone: true },
          });

          if (student?.father_phone) {
            const hasSent = await prisma.attendence.findFirst({
              where: { student_id: studentId, date: formattedDate },
              select: { send_msg: true },
            });

            if (!hasSent?.send_msg) {
              const message = [
                `Dear Parent,`,
                `Your child ${student.name} (ID: ${student.login_id}) has attended school today (${formattedDate}).`,
                `Thank you.`,
                `Head Master`,
                `Panchbibi Lal Bihari Govt. High School.`,
              ].join("\n");

              const smsLog = await prisma.sms_logs.create({
                data: {
                  student_id: studentId,
                  phone_number: student.father_phone,
                  message: message,
                  attendance_date: formattedDate,
                  status: "pending",
                },
              });

              const phoneKey = `88${student.father_phone}`;
              smsMessages.push({ Number: phoneKey, Text: message });
              
              if (!smsLogMap.has(phoneKey)) smsLogMap.set(phoneKey, []);
              smsLogMap.get(phoneKey).push({ smsLogId: smsLog.id, studentId, date: formattedDate });
            }
          }
        }
      } catch (err: any) {
        errors.push({ studentId, error: err.message });
      }
    }

    // Process SMS Messages
    if (smsMessages.length > 0) {
      try {
        const bulkSmsResponse = await SMSService.sendBulkSMS(smsMessages);
        if (bulkSmsResponse.success && bulkSmsResponse.data?.results) {
          for (const result of bulkSmsResponse.data.results) {
            const logs = smsLogMap.get(result.to);
            if (logs) {
              for (const log of logs) {
                if (result.status === "sent") {
                  smsSuccessCount++;
                  await prisma.sms_logs.update({
                    where: { id: log.smsLogId },
                    data: { status: "sent", message_id: result.message_id },
                  });
                  await prisma.attendence.updateMany({
                    where: { student_id: log.studentId, date: log.date },
                    data: { send_msg: true },
                  });
                } else {
                  smsFailedCount++;
                  await prisma.sms_logs.update({
                    where: { id: log.smsLogId },
                    data: { status: "failed", error_reason: result.code || "API Error" },
                  });
                }
              }
            }
          }
        }
      } catch (smsErr) {
        smsFailedCount += smsMessages.length;
      }
    }

    return {
      processed: processed.length,
      present: presentCount,
      absent: absentCount,
      errors,
      sms: { successful: smsSuccessCount, failed: smsFailedCount },
    };
  }
}
