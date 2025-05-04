import pool from "../config/db.js";

export const getAttendenceController = async (req, res) => {
  try {
    const attendence = await pool.query("SELECT * FROM attendence");
    res.status(200).json(attendence.rows);
  } catch (error) {
    console.error("Error fetching attendence:", error);
    res.status(500).json({ error: "Error fetching attendence" });
  }
};

export const addAttendenceController = async (req, res) => {
  const today = new Date().toLocaleDateString("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  try {
    const { records } = req.body;
    records.forEach(async (record) => {
      let { studentId, date, status } = record;
      date = new Date(date).toLocaleDateString("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const existingRecord = await pool.query(
        "SELECT * FROM attendence WHERE student_id = $1 AND date = $2",
        [studentId, date]
      );
      if (existingRecord.rows.length > 0) {
        await pool.query(
          "UPDATE attendence SET status = $1 WHERE student_id = $2 AND date = $3",
          [status, studentId, date]
        );
      } else {
        await pool.query(
          "INSERT INTO attendence (student_id, date, status) VALUES ($1, $2, $3)",
          [studentId, date, status]
        );
      }

      if (date === today && status === "absent") {
        const student = await pool.query(
          "SELECT * FROM students WHERE id = $1",
          [studentId]
        );
        const parent_phone = student.rows[0].parent_phone;
        const sent = await pool.query(
          "SELECT send_msg FROM attendence WHERE student_id = $1 AND date = $2",
          [studentId, date]
        );
        if (sent.rows[0].send_msg === false) {
          const message = `Dear Parent, your child is absent today. Please check with them.`;
          console.log("Sending SMS to parent:", parent_phone, message);
          await pool.query(
            "UPDATE attendence SET send_msg = $1 WHERE student_id = $2 AND date = $3",
            [true, studentId, date] 
          );
        } else {
          console.log("Message already sent for this date.");
          return;
        }
        // Uncomment the following lines to send SMS using Twilio
        // const twilioClient = require("twilio")(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);
        // await twilioClient.messages.create({
        //   body: message,
        //   from: process.env.TWILIO_PHONE_NUMBER,
        //   to: parent_phone,
        // });
      }
    });
    res.status(200).json({ message: "Attendence added successfully" });
  } catch (error) {
    console.error("Error adding attendence:", error);
    res.status(500).json({ error: "Error adding attendence" });
  }
};
