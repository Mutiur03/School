import { prisma } from "../config/prisma.js";
import axios from "axios";
import jwt from "jsonwebtoken";
export const getAttendenceController = async (req, res) => {
  if (!req.cookies.teacher_token && !req.cookies.admin_token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.cookies.admin_token) {
    const token = req.cookies.admin_token;
    console.log(token);
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
      console.log(levelConditions);
      
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

  const today = new Date().toLocaleDateString("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  try {
    const API_KEY = process.env.BULK_SMS_API_KEY;
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
        allowedStudentIds = []; // Teacher has no assigned levels
      }
    }

    const errors = [];
    const processed = [];
    let smsSuccessCount = 0;
    let smsFailedCount = 0;
    let absentCount = 0;

    for (const record of records) {
      let { studentId, date, status } = record;
      date = new Date(date).toLocaleDateString("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

      try {
        // Check if teacher is authorized to mark attendance for this student
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

        // Count absent students
        if (status === "absent") {
          absentCount++;
        }

        if (date === today && status === "absent") {
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
            const message = `Dear Parent, your child is absent today. Please check with them.`;
            console.log("Sending SMS to parent:", parent_phone, message);

            try {
              if (!API_KEY) {
                console.warn(
                  "SMS API key not configured, skipping SMS notification"
                );
                smsFailedCount++;
              } else {
                console.log(API_KEY);
                const smsResponse = await axios.post(
                  `https://api.sms.net.bd/sendsms?api_key=${API_KEY}&to=88${parent_phone}&msg=${encodeURIComponent(
                    message
                  )}`
                );
                console.log(`SMS sent to ${parent_phone}: ${message}`);
                console.log("SMS Response:", smsResponse.data);
                if (smsResponse.data.error !== 0) {
                  smsFailedCount++;
                } else {
                  smsSuccessCount++;
                  // Only mark as sent if SMS was successful
                  await prisma.attendence.updateMany({
                    where: {
                      student_id: studentId,
                      date: date,
                    },
                    data: { send_msg: true },
                  });
                }
              }
            } catch (smsError) {
              console.error(
                `Failed to send SMS to ${parent_phone}:`,
                smsError.message
              );
              smsFailedCount++;
            }
          } else {
            console.log("Message already sent for this date.");
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

    if (errors.length === 0) {
      res.status(200).json({
        message: "All attendance records processed successfully",
        processed: processed.length,
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
