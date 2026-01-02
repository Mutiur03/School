import { prisma } from "../config/prisma.js";
import axios from "axios";
import jwt from "jsonwebtoken";
const sendBulkSMS = async (messageParameters, API_KEY, SENDER_ID) => {
  const bulkSmsPayload = {
    api_key: API_KEY,
    senderid: SENDER_ID,
    MessageParameters: messageParameters,
  };

  console.log("Sending bulk SMS request:", {
    messageCount: messageParameters.length,
    hasSenderId: !!SENDER_ID,
    endpoint: "https://sms.onecodesoft.com/api/send-bulk-sms",
  });

  try {
    const response = await axios.post(
      "https://sms.onecodesoft.com/api/send-bulk-sms",
      bulkSmsPayload,
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        timeout: 30000, // 30 second timeout
      }
    );

    console.log("SMS API Response received:", {
      status: response.status,
      statusText: response.statusText,
      dataSummary: response.data,
    });

    return response.data;
  } catch (error) {
    console.error("Bulk SMS Error Details:", {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data,
      isTimeout: error.code === "ECONNABORTED",
    });
    throw error;
  }
};

export const getAttendenceController = async (req, res) => {
  if (!req.cookies.teacher_token && !req.cookies.admin_token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.cookies.admin_token) {
    const token = req.cookies.admin_token;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      const admin = await prisma.admin.findUnique({
        where: { id: req.user.id },
      });
      if (!admin) {
        res.clearCookie("admin_token");
        return res.status(404).json({ message: "Admin not found" });
      }
      const attendenceRecords = await prisma.attendence.findMany();
      res.status(200).json(attendenceRecords);
    } catch (error) {
      res.clearCookie("admin_token");
      return res.status(401).json({ message: "Invalid Admin Token" });
    }
  } else if (req.cookies.teacher_token) {
    const token = req.cookies.teacher_token;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      const teacher = await prisma.teachers.findUnique({
        where: { id: req.user.id },
        include: { levels: true },
      });
      if (!teacher) {
        res.clearCookie("teacher_token");
        return res.status(404).json({ message: "Teacher not found" });
      }

      if (!teacher.levels || teacher.levels.length === 0) {
        return res.status(200).json([]);
      }

      const levelConditions = teacher.levels.map((level) => ({
        class: level.class_name,
        section: level.section,
        year: level.year,
      }));
      const attendenceRecords = await prisma.attendence.findMany({
        where: {
          student: {
            enrollments: {
              some: {
                OR: levelConditions,
              },
            },
          },
        },
        include: {
          student: {
            select: {
              id: true,
              login_id: true,
              name: true,
              batch: true,
              enrollments: {
                where: {
                  OR: levelConditions,
                },
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
        orderBy: [{ date: "desc" }, { student: { name: "asc" } }],
      });

      res.status(200).json(attendenceRecords);
    } catch (error) {
      console.error("Teacher attendance fetch error:", error);
      res.clearCookie("teacher_token");
      return res.status(401).json({ message: "Invalid Teacher Token" });
    }
  }
};

export const addAttendenceController = async (req, res) => {
  if (!req.cookies.teacher_token && !req.cookies.admin_token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Use Bangladesh timezone for today's date
  const today = new Date().toLocaleDateString("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Dhaka",
  });

  try {
    const API_KEY = process.env.BULK_SMS_API_KEY;
    const SENDER_ID = process.env.BULK_SMS_SENDER_ID;
    const { records } = req.body;

    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ error: "Invalid records format" });
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
          where: {
            OR: levelConditions,
          },
          select: { student_id: true },
        });

        allowedStudentIds = allowedEnrollments.map((e) => e.student_id);
      } else {
        allowedStudentIds = [];
      }
    }

    const errors = [];
    const processed = [];
    let smsSuccessCount = 0;
    let smsFailedCount = 0;
    let absentCount = 0;
    let presentCount = 0;
    const smsMessages = [];
    const smsLogMap = new Map(); // Map phone number to array of student data

    for (const record of records) {
      let { studentId, date, status } = record;
      // Use Bangladesh timezone for consistent date handling
      date = new Date(date).toLocaleDateString("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Asia/Dhaka",
      });

      try {
        if (
          allowedStudentIds !== null &&
          !allowedStudentIds.includes(studentId)
        ) {
          errors.push({
            studentId,
            error: "Not authorized to mark attendance for this student",
          });
          continue;
        }

        const existingRecord = await prisma.attendence.findFirst({
          where: {
            student_id: studentId,
            date: date,
          },
        });

        if (existingRecord) {
          await prisma.attendence.update({
            where: { id: existingRecord.id },
            data: { status: status },
          });
        } else {
          await prisma.attendence.create({
            data: {
              student_id: studentId,
              date: date,
              status: status,
            },
          });
        }

        processed.push({ studentId, date, status });

        if (status === "absent") {
          absentCount++;
        } else if (status === "present") {
          presentCount++;
        }

        if (date === today && status === "present") {
          const student = await prisma.students.findUnique({
            where: { id: studentId },
          });

          if (!student) {
            console.error(`Student not found with ID: ${studentId}`);
            continue;
          }

          const parent_phone = student.parent_phone;

          const sent = await prisma.attendence.findFirst({
            where: {
              student_id: studentId,
              date: date,
            },
            select: { send_msg: true },
          });

          if (sent && sent.send_msg === false) {
            const message = [
              `Dear Parent,`,
              `Your child ${student.name} (ID: ${student.login_id}) has attended school today (${date}).`,
              `Thank you.`,
              `Head Master`,
              `Panchbibi Lal Bihari Govt. High School.`,
            ].join("\n");

            try {
              const smsLog = await prisma.sms_logs.create({
                data: {
                  student_id: studentId,
                  phone_number: parent_phone,
                  message: message,
                  attendance_date: date,
                  status: "pending",
                },
              });

              smsMessages.push({
                Number: `88${parent_phone}`,
                Text: message,
              });

              // Handle multiple students with same phone number
              const phoneKey = `88${parent_phone}`;
              if (!smsLogMap.has(phoneKey)) {
                smsLogMap.set(phoneKey, []);
              }
              smsLogMap.get(phoneKey).push({
                smsLogId: smsLog.id,
                studentId: studentId,
                date: date,
              });
            } catch (smsLogError) {
              console.error(
                `Failed to create SMS log for student ${studentId}:`,
                {
                  error: smsLogError.message,
                  stack: smsLogError.stack,
                  studentId,
                  phone: parent_phone,
                }
              );
              // Continue processing other students even if SMS log creation fails
            }
          }
        }
      } catch (recordError) {
        console.error(
          `Error processing record for student ${studentId}:`,
          recordError
        );
        errors.push({
          studentId,
          error: recordError.message || "Unknown error",
        });
        continue;
      }
    }

    if (smsMessages.length > 0) {
      try {
        if (!API_KEY || !SENDER_ID) {
          const missingConfig = [];
          if (!API_KEY) missingConfig.push("API_KEY");
          if (!SENDER_ID) missingConfig.push("SENDER_ID");

          console.error(
            `SMS configuration missing: ${missingConfig.join(", ")}`
          );
          console.warn(
            "SMS API key/sender ID not configured, marking all SMS as failed"
          );

          for (const [phoneNumber, smsDataArray] of smsLogMap) {
            try {
              // Count only one failure per phone number
              smsFailedCount++;

              for (const smsData of smsDataArray) {
                await prisma.sms_logs.update({
                  where: { id: smsData.smsLogId },
                  data: {
                    status: "failed",
                    error_reason: `SMS configuration missing: ${missingConfig.join(
                      ", "
                    )}`,
                  },
                });
              }
            } catch (updateError) {
              console.error(
                `Failed to update SMS logs for ${phoneNumber}:`,
                updateError.message
              );
            }
          }
        } else {
          const bulkSmsResponse = await sendBulkSMS(
            smsMessages,
            API_KEY,
            SENDER_ID
          );

          console.log("Bulk SMS API Response:", {
            hasResponse: !!bulkSmsResponse,
            hasResults: !!(bulkSmsResponse && bulkSmsResponse.results),
            resultCount: bulkSmsResponse?.results?.length || 0,
          });

          if (bulkSmsResponse && bulkSmsResponse.results) {
            for (const result of bulkSmsResponse.results) {
              const smsDataArray = smsLogMap.get(result.to);
              if (smsDataArray) {
                if (result.status === "sent") {
                  // Count only one success per phone number (not per student)
                  smsSuccessCount++;

                  // Update all students with this phone number
                  for (const smsData of smsDataArray) {
                    try {
                      await prisma.sms_logs.update({
                        where: { id: smsData.smsLogId },
                        data: {
                          status: "sent",
                          sms_count: result.sms_count || 1,
                          message_id: result.message_id,
                        },
                      });

                      await prisma.attendence.updateMany({
                        where: {
                          student_id: smsData.studentId,
                          date: smsData.date,
                        },
                        data: { send_msg: true },
                      });
                    } catch (updateError) {
                      console.error(
                        `Failed to update records for student ${smsData.studentId}:`,
                        {
                          error: updateError.message,
                          smsLogId: smsData.smsLogId,
                          studentId: smsData.studentId,
                        }
                      );
                      // Don't increment smsFailedCount here as SMS was sent successfully
                    }
                  }
                } else {
                  // Count only one failure per phone number
                  smsFailedCount++;

                  // Update all failed SMS logs for this phone number
                  for (const smsData of smsDataArray) {
                    try {
                      await prisma.sms_logs.update({
                        where: { id: smsData.smsLogId },
                        data: {
                          status: "failed",
                          error_reason: `API Error: ${
                            result.code || "Unknown error"
                          }`,
                        },
                      });
                    } catch (updateError) {
                      console.error(
                        `Failed to update failed SMS log for student ${smsData.studentId}:`,
                        updateError.message
                      );
                    }
                  }
                }
              }
            }
          } else {
            for (const [phoneNumber, smsDataArray] of smsLogMap) {
              // Count only one failure per phone number
              smsFailedCount++;

              for (const smsData of smsDataArray) {
                await prisma.sms_logs.update({
                  where: { id: smsData.smsLogId },
                  data: {
                    status: "failed",
                    error_reason: "Invalid bulk SMS response",
                  },
                });
              }
            }
          }
        }
      } catch (smsError) {
        console.error("Bulk SMS Error:", {
          message: smsError.message,
          response: smsError.response?.data,
        });

        for (const [phoneNumber, smsDataArray] of smsLogMap) {
          try {
            // Count only one failure per phone number
            smsFailedCount++;

            for (const smsData of smsDataArray) {
              await prisma.sms_logs.update({
                where: { id: smsData.smsLogId },
                data: {
                  status: "failed",
                  error_reason: `SMS Service Error: ${smsError.message}`,
                },
              });
            }
          } catch (updateError) {
            console.error(
              `Failed to update SMS logs for ${phoneNumber}:`,
              updateError.message
            );
          }
        }
      }
    }
    if (errors.length === 0) {
      res.status(200).json({
        message: "All attendance records processed successfully",
        processed: processed.length,
        present: presentCount,
        absent: absentCount,
        sms: {
          successful: smsSuccessCount,
          failed: smsFailedCount,
        },
      });
    } else if (processed.length > 0) {
      res.status(207).json({
        message: "Some attendance records processed with errors",
        processed: processed.length,
        present: presentCount,
        absent: absentCount,
        errors: errors,
        sms: {
          successful: smsSuccessCount,
          failed: smsFailedCount,
        },
      });
    } else {
      res.status(400).json({
        error: "No records could be processed",
        present: presentCount,
        absent: absentCount,
        errors: errors,
        sms: {
          successful: smsSuccessCount,
          failed: smsFailedCount,
        },
      });
    }
  } catch (error) {
    console.error("Attendance controller error:", error);
    res.status(500).json({
      error: "Internal Server Error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
