import pool from "../config/db.js";
import puppeteer from "puppeteer";

// Helper function to validate data
const validateMarksData = (data) => {
  if (!Array.isArray(data.students)) {
    throw new Error("Students data must be an array");
  }

  data.students.forEach((student) => {
    if (!student.studentId || !Array.isArray(student.subjectMarks)) {
      throw new Error("Invalid student data structure");
    }

    student.subjectMarks.forEach((mark) => {
      if (!mark.subjectId || typeof mark.marks !== "number") {
        throw new Error("Invalid marks data structure");
      }
      // Ensure marks are at least 0
      mark.marks = Math.max(0, mark.marks);
    });
  });
};

export const addMarksController = async (req, res) => {
  console.log("Received request to add marks:", req.body); // Debug log

  try {
    validateMarksData(req.body);
    const { students, examName, year } = req.body;

    // Get exam ID
    const examResult = await pool.query(
      `SELECT id FROM exams WHERE exam_name = $1 AND exam_year = $2`,
      [examName, year]
    );

    if (examResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Exam "${examName}" not found for year ${year}`,
      });
    }
    const examId = examResult.rows[0].id;

    await pool.query("BEGIN");
    const results = [];
    const errors = [];

    for (const student of students) {
      try {
        // Get enrollment ID
        const enrollmentResult = await pool.query(
          `SELECT id FROM student_enrollments 
           WHERE student_id = $1 AND year = $2`,
          [student.studentId, year]
        );

        if (enrollmentResult.rows.length === 0) {
          errors.push(`Student ${student.studentId} not enrolled in ${year}`);
          continue;
        }
        const enrollmentId = enrollmentResult.rows[0].id;

        // Process each subject mark
        for (const { subjectId, marks } of student.subjectMarks) {
          console.log(`Processing subjectId: ${subjectId}, marks: ${marks}`); // Debug log
          try {
            const result = await pool.query(
              `INSERT INTO marks 
               (enrollment_id, subject_id, exam_id, marks)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT ON CONSTRAINT unique_marks_entry
               DO UPDATE SET 
                 marks = COALESCE(EXCLUDED.marks, 0), -- Ensure null or undefined is stored as 0
                 updated_at = NOW()
               RETURNING id`,
              [enrollmentId, subjectId, examId, marks ?? 0] // Use nullish coalescing to default to 0
            );
            results.push(result.rows[0]);
          } catch (error) {
            errors.push(
              `Failed to process student ${student.studentId} subject ${subjectId}: ${error.message}`
            );
          }
        }
      } catch (error) {
        errors.push(
          `Error processing student ${student.studentId}: ${error.message}`
        );
      }
    }

    await pool.query("COMMIT");

    res.json({
      success: true,
      message: `Processed ${results.length} mark records`,
      count: results.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    await pool.query("ROLLBACK");
    console.error("Error in addMarksController:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Error processing marks",
    });
  }
};

export const getClassMarksController = async (req, res) => {
  try {
    const { className, year, exam } = req.params;

    console.log("Received parameters:", { className, year, exam }); // Debug log

    // const result = await pool.query(
    //   `
    //   SELECT
    //     s.id AS student_id,
    //     s.name AS student_name,
    //     se.roll,
    //     se.class AS class_level,
    //     se.department,
    //     se.section,
    //     sub.id AS subject_id,
    //     sub.name AS subject_name,
    //     m.marks
    //   FROM marks m
    //   JOIN student_enrollments se ON m.enrollment_id = se.id
    //   JOIN students s ON se.student_id = s.id
    //   JOIN subjects sub ON m.subject_id = sub.id
    //   JOIN exams e ON m.exam_id = e.id
    //   WHERE se.class = $1 AND se.year = $2 AND e.exam_name = $3
    //   ORDER BY se.roll, sub.name
    //   `,
    //   [className, year, exam]
    // );
    const result = await pool.query(
      `
      SELECT 
    s.id AS student_id,
    s.name AS student_name,
    se.roll,
    se.class AS class_level,
    se.department,
    se.section,
    sub.id AS subject_id,
    sub.name AS subject_name,
    m.marks
FROM student_enrollments se 
LEFT JOIN students s ON se.student_id = s.id
LEFT JOIN subjects sub ON TRUE  
LEFT JOIN marks m ON se.id = m.enrollment_id AND m.subject_id = sub.id
LEFT JOIN exams e ON m.exam_id = e.id AND e.exam_name = $3
WHERE se.class = $1 AND se.year = $2
ORDER BY se.roll, sub.name;
      `,
      [className, year, exam]
    );
    console.log("Query result:", result.rows); // Debug log

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No marks found for the specified class, year, and exam.",
      });
    }

    const marksByStudent = {};
    result.rows.forEach((row) => {
      if (!marksByStudent[row.student_id]) {
        marksByStudent[row.student_id] = {
          student_id: row.student_id,
          name: row.student_name,
          roll: row.roll,
          class: row.class_level,
          department: row.department,
          section: row.section,
          marks: [],
        };
      }
      marksByStudent[row.student_id].marks.push({
        subject_id: row.subject_id,
        subject: row.subject_name,
        marks: row.marks,
      });
    });

    res.json({
      success: true,
      data: Object.values(marksByStudent),
    });
  } catch (error) {
    console.error("Error fetching class marks:", error);
    res.status(500).json({
      success: false,
      error: "Error fetching marks",
      details: error.message,
    });
  }
};

export const getIndividualMarksController = async (req, res) => {
  try {
    const { id, year, exam } = req.params;
    console.log("Received parameters:", { id, year, exam });

    const result = await pool.query(
      `
        SELECT
          s.name,
          sub.name AS subject,
          sub.full_mark,sub.pass_mark,
          e.exam_name AS exam,
          m.marks,
          se.class,
          se.roll,
          se.year
        FROM marks m
        JOIN student_enrollments se ON m.enrollment_id = se.id
        JOIN students s ON se.student_id = s.id
        JOIN subjects sub ON m.subject_id = sub.id
        JOIN exams e ON m.exam_id = e.id
        WHERE se.student_id = $1
        AND se.year = $2
        AND e.exam_name = $3
      `,
      [id, year, exam]
    );
    console.log("Query result:", result.rows);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No marks found" });
    }

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching marks:", error);
    res.status(500).json({ error: "Error fetching marks" });
  }
};

export const generateMarksheetController = async (req, res) => {
  let browser = null;

  try {
    const { id, year, exam } = req.params;

    const result = await pool.query(
      `
        SELECT 
          s.name AS student_name, 
          sub.name AS subject, 
          e.exam_name AS exam, 
          m.marks AS subject_marks, 
          SUM(m.marks) OVER(PARTITION BY se.student_id, e.exam_name, se.year) AS total_marks, 
          se.class, 
          se.roll, 
          se.year 
        FROM marks m
        JOIN student_enrollments se ON m.enrollment_id = se.id
        JOIN students s ON se.student_id = s.id
        JOIN subjects sub ON m.subject_id = sub.id
        JOIN exams e ON m.exam_id = e.id
        WHERE se.student_id = $1
        AND se.year = $2
        AND e.exam_name = $3;
      `,
      [id, year, exam]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No marks found for the student" });
    }

    const studentData = result.rows;
    const studentName = studentData[0].student_name;
    const studentClass = studentData[0].class;
    const studentRoll = studentData[0].roll;
    const totalMarks = studentData[0].total_marks;

    // Generate HTML content for the PDF
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Marksheet</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
          }
          .marksheet {
            max-width: 800px;
            margin: 0 auto;
            border: 1px solid #ddd;
            padding: 20px;
            text-align: center;
          }
          .header {
            margin-bottom: 20px;
          }
          .header h2 {
            margin: 0;
            font-size: 24px;
          }
          .header p {
            margin: 5px 0;
            font-style: italic;
          }
          .student-info {
            margin-bottom: 20px;
            text-align: left;
          }
          .student-info p {
            margin: 5px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: #f2f2f2;
          }
          .total-marks {
            font-size: 16px;
            font-weight: bold;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="marksheet">
          <div class="header">
            <h2>PANCHBIBI LAL BIHARI PILOT GOVT. HIGH SCHOOL</h2>
            <p>Panchbibi, Joypurhat</p>
            <h3>ACADEMIC TRANSCRIPT</h3>
          </div>

          <div class="student-info">
            <p><strong>Name:</strong> ${studentName}</p>
            <p><strong>Class:</strong> ${studentClass}</p>
            <p><strong>Roll No:</strong> ${studentRoll}</p>
            <p><strong>Year:</strong> ${year}</p>
            <p><strong>Exam:</strong> ${exam}</p>
          </div>

          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Marks</th>
              </tr>
            </thead>
            <tbody>
              ${studentData
                .map(
                  (row) => `
                  <tr>
                    <td>${row.subject}</td>
                    <td>${row.subject_marks}</td>
                  </tr>
                `
                )
                .join("")}
            </tbody>
          </table>

          <div class="total-marks">
            Total Marks: ${totalMarks}
          </div>
        </div>
      </body>
      </html>
    `;

    // Launch Puppeteer
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // Set the HTML content
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: {
        top: "10mm",
        right: "10mm",
        bottom: "10mm",
        left: "10mm",
      },
      printBackground: true,
    });

    // Close the browser
    await browser.close();
    browser = null;

    // Set response headers
    const filename = `marksheet_${id}_${exam}_${year}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);

    // Send the PDF buffer
    res.end(pdfBuffer);
  } catch (error) {
    console.error("Error generating marksheet:", error);

    // Ensure the browser is closed
    if (browser) {
      await browser
        .close()
        .catch((e) => console.error("Error closing browser:", e));
    }

    res.status(500).json({ error: "Error generating marksheet" });
  }
};

export const previewMarksheetController = async (req, res) => {
  try {
    const { id, year } = req.params;

    // Updated database query to pivot exam marks
    const result = await pool.query(
      `
      SELECT 
  s.name AS student_name,
  sub.name AS subject,
  se.class,
  se.roll,
  se.year,
  se.final_merit,
  json_object_agg(e.exam_name, m.marks) AS exam_marks,
  json_object_agg(e.exam_name, tm.total) AS total_marks_per_exam
FROM marks m
JOIN student_enrollments se ON m.enrollment_id = se.id 
JOIN students s ON se.student_id = s.id
JOIN subjects sub ON m.subject_id = sub.id
JOIN exams e ON m.exam_id = e.id
JOIN (
  SELECT 
    m.exam_id,
    SUM(m.marks) AS total
  FROM marks m
  JOIN student_enrollments se ON m.enrollment_id = se.id
  WHERE se.student_id = $1 AND se.year = $2
  GROUP BY m.exam_id
) AS tm ON m.exam_id = tm.exam_id
WHERE se.student_id = $1 AND se.year = $2 
GROUP BY 
  s.name, 
  sub.name, 
  se.class, 
  se.roll, 
  se.year, 
  se.final_merit
ORDER BY sub.name;
      `,
      [id, year]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No marks found" });
    }

    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error generating preview:", error);
    res.status(500).json({ error: "Error generating preview" });
  }
};

export const downloadPreviewMarksheet = async (req, res) => {
  try {
    const { id, year } = req.params;

    const result = await pool.query(
      `
      SELECT 
        s.name AS student_name,
        sub.name AS subject,
        se.class,
        se.roll,
        se.year,
        se.final_merit,
        json_object_agg(e.exam_name, m.marks) AS exam_marks,
        json_object_agg(e.exam_name, tm.total) AS total_marks_per_exam
      FROM marks m
      JOIN student_enrollments se ON m.enrollment_id = se.id 
      JOIN students s ON se.student_id = s.id
      JOIN subjects sub ON m.subject_id = sub.id
      JOIN exams e ON m.exam_id = e.id
      JOIN (
        SELECT 
          m.exam_id,
          SUM(m.marks) AS total
        FROM marks m
        JOIN student_enrollments se ON m.enrollment_id = se.id
        WHERE se.student_id = $1 AND se.year = $2
        GROUP BY m.exam_id
      ) AS tm ON m.exam_id = tm.exam_id
      WHERE se.student_id = $1 AND se.year = $2 
      GROUP BY 
        s.name, 
        sub.name, 
        se.class, 
        se.roll, 
        se.year, 
        se.final_merit
      ORDER BY sub.name;
      `,
      [id, year]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No marks found" });
    }

    const studentData = result.rows;
    const studentName = studentData[0].student_name;
    const studentClass = studentData[0].class;
    const studentRoll = studentData[0].roll;
    const exams = Object.keys(studentData[0].exam_marks);
    const totalMarks = studentData[0].total_marks_per_exam;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Marksheet Preview</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="p-6">
        <div id="marksheet" class="max-w-4xl mx-auto bg-white rounded-lg p-6 shadow">
          <div class="text-center mb-6">
            <h2 class="text-2xl font-bold">PANCHBIBI LAL BIHARI PILOT GOVT. HIGH SCHOOL</h2>
            <p class="italic">Panchbibi, Joypurhat</p>
          </div>

          <div class="flex justify-between mb-6">
            <div>
              <p><strong>Name:</strong> ${studentName}</p>
              <p><strong>Class:</strong> ${studentClass}</p>
            </div>
            <div>
              <p><strong>Roll No:</strong> ${studentRoll}</p>
              <p><strong>Year:</strong> ${year}</p>
            </div>
          </div>

          <table class="table-auto w-full border-collapse border border-gray-300 mb-6">
            <thead>
              <tr class="bg-gray-200 text-center">
                <th class="border border-gray-300 px-4 py-2 text-left">Subject</th>
                ${exams
                  .map(
                    (exam) =>
                      `<th class="border border-gray-300 px-4 py-2">${exam}</th>`
                  )
                  .join("")}
              </tr>
            </thead>
            <tbody>
              ${studentData
                .map((row) => {
                  return `
                  <tr>
                    <td class="border border-gray-300 px-4 py-2">${
                      row.subject
                    }</td>
                    ${exams
                      .map((exam) => {
                        const marks = row.exam_marks[exam];
                        return `<td class="border text-center border-gray-300 px-4 py-2">${
                          marks ?? "-"
                        }</td>`;
                      })
                      .join("")}
                  </tr>
                `;
                })
                .join("")}

              <tr class="bg-gray-100 font-semibold">
                <td class="border border-gray-300 px-4 py-2 text-right">Total</td>
                ${exams
                  .map((exam) => {
                    const total = totalMarks[exam];
                    return `<td class="border text-center border-gray-300 px-4 py-2">${
                      total ?? "-"
                    }</td>`;
                  })
                  .join("")}
              </tr>
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `;

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: {
        top: "10mm",
        right: "10mm",
        bottom: "10mm",
        left: "10mm",
      },
      printBackground: true,
    });

    await browser.close();

    const filename = `marksheet_${studentName}_${year}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (error) {
    console.error("Error downloading preview marksheet:", error);
    res.status(500).json({ error: "Error downloading preview marksheet" });
  }
};

export const downloadAllMarksheetPDF = async (req, res) => {
  try {
    const { year } = req.params;

    const result = await pool.query(
      `
      SELECT 
        s.name AS student_name,
        sub.name AS subject,
        se.class,
        se.roll,
        se.year,
        se.final_merit,
        se.student_id,
        json_object_agg(e.exam_name, m.marks) AS exam_marks,
        json_object_agg(e.exam_name, tm.total) AS total_marks_per_exam
      FROM marks m
      JOIN student_enrollments se ON m.enrollment_id = se.id 
      JOIN students s ON se.student_id = s.id
      JOIN subjects sub ON m.subject_id = sub.id
      JOIN exams e ON m.exam_id = e.id
      JOIN (
        SELECT 
          se.student_id,
          m.exam_id,
          SUM(m.marks) AS total
        FROM marks m
        JOIN student_enrollments se ON m.enrollment_id = se.id
        WHERE se.year = $1
        GROUP BY se.student_id, m.exam_id
      ) AS tm ON m.exam_id = tm.exam_id AND se.student_id = tm.student_id
      WHERE se.year = $1
      GROUP BY 
        s.name, 
        sub.name, 
        se.class, 
        se.roll, 
        se.year, 
        se.final_merit,
        se.student_id
      ORDER BY s.name, sub.name
      `,
      [year]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No marks found" });
    }

    // Group data by student
    const grouped = {};
    for (const row of result.rows) {
      const sid = row.student_id;
      if (!grouped[sid]) {
        grouped[sid] = {
          student_name: row.student_name,
          class: row.class,
          roll: row.roll,
          year: row.year,
          final_merit: row.final_merit,
          subjects: [],
          total_marks_per_exam: row.total_marks_per_exam,
        };
      }
      grouped[sid].subjects.push({
        subject: row.subject,
        exam_marks: row.exam_marks,
      });
    }

    // Generate HTML
    const allMarksheetHTML = Object.values(grouped)
      .map((student) => {
        const examHeaders = Object.keys(student.subjects[0]?.exam_marks || {});
        const totalMarks = student.total_marks_per_exam || {};

        const subjectRows = student.subjects
          .map(
            (sub) => `
              <tr>
                <td class="border border-gray-300 px-4 py-2">${sub.subject}</td>
                ${examHeaders
                  .map(
                    (exam) =>
                      `<td class="border text-center border-gray-300 px-4 py-2">${sub.exam_marks[exam]}</td>`
                  )
                  .join("")}
              </tr>`
          )
          .join("");

        const totalRow = `
          <tr class="bg-gray-100 font-semibold">
            <td class="border border-gray-300 px-4 py-2 text-right">Total</td>
            ${examHeaders
              .map(
                (exam) =>
                  `<td class="border text-center border-gray-300 px-4 py-2">${totalMarks[exam]}</td>`
              )
              .join("")}
          </tr>
        `;

        return `
        <div class="max-w-4xl mx-auto bg-white rounded-lg p-6 page-break">
          <div class="text-center mb-6">
            <h2 class="text-2xl font-bold">PANCHBIBI LAL BIHARI PILOT GOVT. HIGH SCHOOL</h2>
            <p class="italic">Panchbibi, Joypurhat</p>
          </div>

          <div class="flex justify-between mb-4">
            <div>
              <p><strong>Name:</strong> ${student.student_name}</p>
              <p><strong>Class:</strong> ${student.class}</p>
            </div>
            <div>
              <p><strong>Roll No:</strong> ${student.roll}</p>
              <p><strong>Year:</strong> ${student.year}</p>
            </div>
            <div>
              <p><strong>Final Merit:</strong> ${student.final_merit || "-"}</p>
            </div>
          </div>

          <table class="table-auto w-full border-collapse border border-gray-300 mb-6">
            <thead>
              <tr class="bg-gray-200">
                <th class="border border-gray-300 px-4 py-2">Subject</th>
                ${examHeaders
                  .map(
                    (exam) =>
                      `<th class="border border-gray-300 px-4 py-2">${exam}</th>`
                  )
                  .join("")}
              </tr>
            </thead>
            <tbody>
              ${subjectRows}
              ${totalRow}
            </tbody>
          </table>
        </div>
        `;
      })
      .join("");

    const finalHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>All Marksheet PDF</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          .page-break {
            page-break-after: always;
          }
        </style>
      </head>
      <body class="">
        ${allMarksheetHTML}
      </body>
      </html>
    `;

    // Generate PDF with Puppeteer
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(finalHTML, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: {
        top: "10mm",
        right: "10mm",
        bottom: "10mm",
        left: "10mm",
      },
      printBackground: true,
    });

    await browser.close();

    const filename = `all_marksheets_${year}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (error) {
    console.error("Error generating all marksheets PDF:", error);
    res.status(500).json({ error: "Error generating all marksheets PDF" });
  }
};

export const addGPAController = async (req, res) => {
  try {
    const { students, examName } = req.body;
    if (!Array.isArray(students)) {
      return res.status(400).json({ error: "students is not iterable" });
    }
    console.log("Received students:", students);

    for (const student of students) {
      console.log(student);

      // Check if student_id exists in the students table
      const studentExists = await pool.query(
        `SELECT id FROM students WHERE id = $1`,
        [student.studentId]
      );

      if (studentExists.rows.length === 0) {
        console.error(`Student ID ${student.studentId} does not exist.`);
        continue; // Skip this student if the ID does not exist
      }

      if (examName === "JSC") {
        const result = await pool.query(
          `INSERT INTO gpa (jsc_gpa, student_id) 
           VALUES ($1, $2) 
           ON CONFLICT (student_id) 
           DO UPDATE SET jsc_gpa = COALESCE($1, 0)`,
          [student.gpa || 0, student.studentId]
        );
      } else if (examName === "SSC") {
        const result = await pool.query(
          `INSERT INTO gpa (ssc_gpa, student_id) 
           VALUES ($1, $2) 
           ON CONFLICT (student_id) 
           DO UPDATE SET ssc_gpa = COALESCE($1, 0)`,
          [student.gpa || 0, student.studentId]
        );
      }
    }
    res.status(200).json({ message: "Marks saved successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllStudentsGPAController = async (req, res) => {
  try {
    const { year } = req.params;
    console.log("Received year:", year);

    const result = await pool.query(
      `
      SELECT 
        s.id AS student_id,
        s.name AS student_name,
        se.class,
        se.roll,
        g.jsc_gpa,
        g.ssc_gpa
      FROM students s
      LEFT JOIN gpa g ON s.id = g.student_id
      JOIN student_enrollments se ON s.id = se.student_id
      WHERE se.year = $1
      `,
      [year]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No GPA records found for the specified year" });
    }

    res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching all students' GPA:", error);
    res.status(500).json({ error: "Error fetching all students' GPA" });
  }
};
