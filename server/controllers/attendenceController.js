import { prisma } from "../config/prisma.js";

// Helper function to handle database connection errors
const handleDatabaseError = (error, operation) => {
  if (
    error.code === "P1001" ||
    error.message.includes("Can't reach database server")
  ) {
    console.error(
      `Database connection failed during ${operation}:`,
      error.message
    );
    return {
      status: 503,
      message:
        "Database service temporarily unavailable. Please try again later.",
      error: "DATABASE_CONNECTION_ERROR",
    };
  }

  console.error(`Error during ${operation}:`, error);
  return {
    status: 500,
    message: `Error ${operation}`,
    error: "INTERNAL_SERVER_ERROR",
  };
};

// Helper function to retry database operations
const retryOperation = async (operation, maxRetries = 3, delay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (
        attempt === maxRetries ||
        !error.message.includes("Can't reach database server")
      ) {
        throw error;
      }
      console.log(
        `Database connection attempt ${attempt} failed, retrying in ${delay}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
};

export const getAttendenceController = async (req, res) => {
  try {
    const attendence = await retryOperation(() => prisma.attendence.findMany());
    res.status(200).json(attendence);
  } catch (error) {
    const errorResponse = handleDatabaseError(error, "fetching attendence");
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const addAttendenceController = async (req, res) => {
  const today = new Date().toLocaleDateString("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  try {
    const API_KEY = process.env.BULK_SMS_API_KEY;
    const { records } = req.body;

    for (const record of records) {
      let { studentId, date, status } = record;
      date = new Date(date).toLocaleDateString("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

      try {
        const existingRecord = await retryOperation(() =>
          prisma.attendence.findFirst({
            where: {
              student_id: studentId,
              date: date,
            },
          })
        );

        if (existingRecord) {
          await retryOperation(() =>
            prisma.attendence.update({
              where: { id: existingRecord.id },
              data: { status: status },
            })
          );
        } else {
          await retryOperation(() =>
            prisma.attendence.create({
              data: {
                student_id: studentId,
                date: date,
                status: status,
              },
            })
          );
        }

        if (date === today && status === "absent") {
          const student = await retryOperation(() =>
            prisma.students.findUnique({
              where: { id: studentId },
            })
          );

          if (!student) {
            console.error(`Student not found with ID: ${studentId}`);
            continue;
          }

          const parent_phone = student.parent_phone;

          const sent = await retryOperation(() =>
            prisma.attendence.findFirst({
              where: {
                student_id: studentId,
                date: date,
              },
              select: { send_msg: true },
            })
          );

          if (sent && sent.send_msg === false) {
            const message = `Dear Parent, your child is absent today. Please check with them.`;
            console.log("Sending SMS to parent:", parent_phone, message);

            await retryOperation(() =>
              prisma.attendence.updateMany({
                where: {
                  student_id: studentId,
                  date: date,
                },
                data: { send_msg: true },
              })
            );

            try {
              console.log(`SMS sent to ${parent_phone}: ${message}`);
              // const smsResponse = await axios.post(
              //   `http://bulksmsbd.net/api/smsapi?api_key=${API_KEY}&type=text&number=88${parent_phone}&senderid=Random&message=${encodeURIComponent(
              //     message
              //   )}`
              // );

              // console.log("SMS Response:", smsResponse.data);
            } catch (smsError) {
              console.error("Error sending SMS:", smsError);
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
        // Continue processing other records even if one fails
        continue;
      }
    }

    res.status(200).json({ message: "Attendence processed successfully" });
  } catch (error) {
    const errorResponse = handleDatabaseError(error, "adding attendence");
    res.status(errorResponse.status).json(errorResponse);
  }
};
