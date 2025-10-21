import puppeteer from "puppeteer";
import { prisma } from "../config/prisma.js";
const validateMarksData = (data) => {
  if (!Array.isArray(data.students)) {
    throw new Error("Students data must be an array");
  }
  data.students.forEach((student) => {
    if (!student.studentId || !Array.isArray(student.subjectMarks)) {
      throw new Error("Invalid student data structure");
    }
    student.subjectMarks.forEach((mark) => {
      if (!mark.subjectId) {
        throw new Error("Invalid marks data structure - missing subjectId");
      }
      // Validate and sanitize mark components
      mark.cq_marks = Math.max(0, parseInt(mark.cq_marks) || 0);
      mark.mcq_marks = Math.max(0, parseInt(mark.mcq_marks) || 0);
      mark.practical_marks = Math.max(0, parseInt(mark.practical_marks) || 0);
    });
  });
};

export const addMarksController = async (req, res) => {
  try {
    console.log("=== ADD MARKS CONTROLLER START ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    if (!req.body) {
      return res.status(400).json({
        success: false,
        error: "Request body is required",
      });
    }
    validateMarksData(req.body);
    const { students, examName, year } = req.body;
    if (!examName || !year) {
      return res.status(400).json({
        success: false,
        error: "examName and year are required",
      });
    }
    console.log(`Looking for exam: ${examName}, year: ${year}`);
    const exam = await prisma.exams.findFirst({
      where: {
        exam_name: examName,
        exam_year: parseInt(year),
      },
    });
    if (!exam) {
      console.log(`Exam not found: ${examName} for year ${year}`);
      const allExams = await prisma.exams.findMany({
        select: {
          id: true,
          exam_name: true,
          exam_year: true,
        },
      });
      console.log("Available exams:", allExams);
      return res.status(404).json({
        success: false,
        error: `Exam "${examName}" not found for year ${year}`,
        availableExams: allExams,
      });
    }
    console.log(`Found exam:`, exam);
    const results = [];
    const errors = [];
    for (const student of students) {
      try {
        console.log(`Processing student: ${student.studentId}`);
        const enrollment = await prisma.student_enrollments.findFirst({
          where: {
            student_id: student.studentId,
            year: parseInt(year),
          },
        });
        if (!enrollment) {
          const errorMsg = `Student ${student.studentId} not enrolled in ${year}`;
          console.log(errorMsg);
          errors.push(errorMsg);
          continue;
        }
        console.log(`Found enrollment:`, enrollment);
        for (const {
          subjectId,
          cq_marks,
          mcq_marks,
          practical_marks,
        } of student.subjectMarks) {
          try {
            console.log(
              `Processing marks for student ${student.studentId}, subject ${subjectId}, CQ: ${cq_marks}, MCQ: ${mcq_marks}, Practical: ${practical_marks}`
            );

            // Calculate total marks
            const totalMarks =
              (cq_marks || 0) + (mcq_marks || 0) + (practical_marks || 0);

            const subject = await prisma.subjects.findUnique({
              where: { id: subjectId },
            });
            if (!subject) {
              const errorMsg = `Subject ${subjectId} not found`;
              console.log(errorMsg);
              errors.push(errorMsg);
              continue;
            }
            console.log(`Found subject:`, subject);

            let result;
            try {
              const existingMark = await prisma.marks.findFirst({
                where: {
                  enrollment_id: enrollment.id,
                  subject_id: subjectId,
                  exam_id: exam.id,
                },
              });

              const markData = {
                cq_marks: cq_marks || 0,
                mcq_marks: mcq_marks || 0,
                practical_marks: practical_marks || 0,
                marks: totalMarks,
              };

              if (existingMark) {
                result = await prisma.marks.update({
                  where: {
                    id: existingMark.id,
                  },
                  data: markData,
                });
                console.log(`Updated existing mark:`, result);
              } else {
                result = await prisma.marks.create({
                  data: {
                    enrollment_id: enrollment.id,
                    subject_id: subjectId,
                    exam_id: exam.id,
                    ...markData,
                  },
                });
                console.log(`Created new mark:`, result);
              }
            } catch (upsertError) {
              console.error("Upsert error:", upsertError);
              try {
                result = await prisma.marks.create({
                  data: {
                    enrollment_id: enrollment.id,
                    subject_id: subjectId,
                    exam_id: exam.id,
                    cq_marks: cq_marks || 0,
                    mcq_marks: mcq_marks || 0,
                    practical_marks: practical_marks || 0,
                    marks: totalMarks,
                  },
                });
                console.log(`Created mark with fallback:`, result);
              } catch (createError) {
                console.error("Create error:", createError);
                throw createError;
              }
            }
            results.push(result);
          } catch (error) {
            const errorMsg = `Failed to process student ${student.studentId} subject ${subjectId}: ${error.message}`;
            console.error(errorMsg, error);
            errors.push(errorMsg);
          }
        }
      } catch (error) {
        const errorMsg = `Error processing student ${student.studentId}: ${error.message}`;
        console.error(errorMsg, error);
        errors.push(errorMsg);
      }
    }
    const response = {
      success: true,
      message: `Processed ${results.length} mark records`,
      count: results.length,
      errors: errors.length > 0 ? errors : undefined,
    };
    console.log("Final response:", response);
    console.log("=== ADD MARKS CONTROLLER END ===");
    res.json(response);
  } catch (error) {
    console.error("=== CONTROLLER ERROR ===");
    console.error("Error in addMarksController:", error);
    console.error("Error name:", error.name);
    console.error("Error code:", error.code);
    console.error("Stack trace:", error.stack);
    res.status(500).json({
      success: false,
      error: error.message || "Error processing marks",
      errorName: error.name,
      errorCode: error.code,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

export const getClassMarksController = async (req, res) => {
  try {
    const { className, year, exam } = req.params;
    const result = await prisma.student_enrollments.findMany({
      where: {
        class: Number(className),
        year: parseInt(year),
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
          },
        },
        marks: {
          where: {
            exam: {
              exam_name: exam,
            },
          },
          include: {
            subject: {
              select: {
                id: true,
                name: true,
                full_mark: true,
                cq_mark: true,
                mcq_mark: true,
                practical_mark: true,
              },
            },
            exam: {
              select: {
                exam_name: true,
              },
            },
          },
        },
      },
      orderBy: [
        {
          roll: "asc",
        },
        {
          student: {
            name: "asc",
          },
        },
      ],
    });

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No marks found for the specified class, year, and exam.",
      });
    }

    const formattedData = result.map((enrollment) => ({
      student_id: enrollment.student.id,
      name: enrollment.student.name,
      roll: enrollment.roll,
      class: enrollment.class,
      department: enrollment.department,
      section: enrollment.section,
      marks: enrollment.marks.map((mark) => ({
        subject_id: mark.subject.id,
        subject: mark.subject.name,
        cq_marks: mark.cq_marks,
        mcq_marks: mark.mcq_marks,
        practical_marks: mark.practical_marks,
        marks: mark.marks,
        subject_info: {
          full_mark: mark.subject.full_mark,
          cq_mark: mark.subject.cq_mark,
          mcq_mark: mark.subject.mcq_mark,
          practical_mark: mark.subject.practical_mark,
        },
      })),
    }));

    res.json({
      success: true,
      data: formattedData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Error fetching marks",
      details: error.message,
    });
  }
};

export const getIndividualMarksController = async (req, res) => {
  try {
    console.log("=== GET INDIVIDUAL MARKS CONTROLLER START ===");
    console.log("Request params:", req.params);
    const { id, year, exam } = req.params;
    if (!id || isNaN(parseInt(id))) {
      console.log("Invalid student ID:", id);
      return res.status(400).json({
        success: false,
        error: "Invalid student ID parameter",
      });
    }
    if (!year || isNaN(parseInt(year))) {
      console.log("Invalid year:", year);
      return res.status(400).json({
        success: false,
        error: "Invalid year parameter",
      });
    }
    if (!exam) {
      console.log("Missing exam parameter");
      return res.status(400).json({
        success: false,
        error: "Exam parameter is required",
      });
    }
    console.log(
      `Searching for marks - Student ID: ${id}, Year: ${year}, Exam: ${exam}`
    );
    const result = await prisma.marks.findMany({
      where: {
        enrollment: {
          student_id: parseInt(id),
          year: parseInt(year),
        },
        exam: {
          exam_name: exam,
        },
      },
      include: {
        enrollment: {
          include: {
            student: {
              select: {
                name: true,
              },
            },
          },
        },
        subject: {
          select: {
            name: true,
            full_mark: true,
            pass_mark: true,
            cq_mark: true,
            mcq_mark: true,
            practical_mark: true,
            cq_pass_mark: true,
            mcq_pass_mark: true,
            practical_pass_mark: true,
          },
        },
        exam: {
          select: {
            exam_name: true,
          },
        },
      },
    });
    console.log(`Found ${result.length} marks records`);
    if (result.length === 0) {
      const studentExists = await prisma.students.findUnique({
        where: { id: parseInt(id) },
      });
      if (!studentExists) {
        console.log(`Student ${id} not found`);
        return res.status(404).json({
          success: false,
          message: "Student not found",
        });
      }
      const enrollmentExists = await prisma.student_enrollments.findFirst({
        where: {
          student_id: parseInt(id),
          year: parseInt(year),
        },
      });
      if (!enrollmentExists) {
        console.log(`Student ${id} not enrolled in year ${year}`);
        return res.status(404).json({
          success: false,
          message: "Student not enrolled for the specified year",
        });
      }
      const examExists = await prisma.exams.findFirst({
        where: { exam_name: exam },
      });
      if (!examExists) {
        console.log(`Exam ${exam} not found`);
        return res.status(404).json({
          success: false,
          message: "Exam not found",
        });
      }
      console.log("Student, enrollment, and exam exist but no marks found");
      return res.status(404).json({
        success: false,
        message: "No marks found for this student, year, and exam",
      });
    }
    const formattedResult = result.map((mark) => ({
      name: mark.enrollment.student.name,
      subject: mark.subject.name,
      full_mark: mark.subject.full_mark,
      pass_mark: mark.subject.pass_mark,
      exam: mark.exam.exam_name,
      cq_marks: mark.cq_marks,
      mcq_marks: mark.mcq_marks,
      practical_marks: mark.practical_marks,
      marks: mark.marks,
      class: mark.enrollment.class,
      roll: mark.enrollment.roll,
      year: mark.enrollment.year,
      subject_breakdown: {
        cq_mark: mark.subject.cq_mark,
        mcq_mark: mark.subject.mcq_mark,
        practical_mark: mark.subject.practical_mark,
        cq_pass_mark: mark.subject.cq_pass_mark,
        mcq_pass_mark: mark.subject.mcq_pass_mark,
        practical_pass_mark: mark.subject.practical_pass_mark,
      },
    }));
    console.log("Successfully formatted result");
    console.log("=== GET INDIVIDUAL MARKS CONTROLLER END ===");
    res.json({
      success: true,
      data: formattedResult,
    });
  } catch (error) {
    console.error("=== ERROR IN GET INDIVIDUAL MARKS CONTROLLER ===");
    console.error("Error details:", error);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error code:", error.code);
    console.error("Stack trace:", error.stack);
    res.status(500).json({
      success: false,
      error: "Error fetching marks",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const generateMarksheetController = async (req, res) => {
  let browser = null;
  try {
    const { id, year, exam } = req.params;
    const result = await prisma.marks.findMany({
      where: {
        enrollment: {
          student_id: parseInt(id),
          year: parseInt(year),
        },
        exam: {
          exam_name: exam,
        },
      },
      include: {
        enrollment: {
          include: {
            student: {
              select: {
                name: true,
              },
            },
          },
        },
        subject: {
          select: {
            name: true,
          },
        },
        exam: {
          select: {
            exam_name: true,
          },
        },
      },
    });
    if (result.length === 0) {
      return res
        .status(404)
        .json({ message: "No marks found for the student" });
    }
    const studentName = result[0].enrollment.student.name;
    const studentClass = result[0].enrollment.class;
    const studentRoll = result[0].enrollment.roll;
    const totalMarks = result.reduce((sum, mark) => sum + mark.marks, 0);
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Marksheet</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="font-sans m-0 p-5">
        <div class="max-w-4xl mx-auto border border-gray-300 p-5 text-center">
          <div class="mb-5">
            <h2 class="m-0 text-2xl font-bold">PANCHBIBI LAL BIHARI PILOT GOVT. HIGH SCHOOL</h2>
            <p class="my-1 italic">Panchbibi, Joypurhat</p>
            <h3 class="text-xl font-semibold mt-4">ACADEMIC TRANSCRIPT</h3>
          </div>
          <div class="mb-5 text-left">
            <p class="my-1"><strong>Name:</strong> ${studentName}</p>
            <p class="my-1"><strong>Class:</strong> ${studentClass}</p>
            <p class="my-1"><strong>Roll No:</strong> ${studentRoll}</p>
            <p class="my-1"><strong>Year:</strong> ${year}</p>
            <p class="my-1"><strong>Exam:</strong> ${exam}</p>
          </div>
          <table class="w-full border-collapse border border-gray-300 mb-5">
            <thead>
              <tr>
                <th class="border border-gray-300 p-2 text-left bg-gray-100">Subject</th>
                <th class="border border-gray-300 p-2 text-left bg-gray-100">Marks</th>
              </tr>
            </thead>
            <tbody>
              ${result
                .map(
                  (mark) => `
                  <tr>
                    <td class="border border-gray-300 p-2">${mark.subject.name}</td>
                    <td class="border border-gray-300 p-2">${mark.marks}</td>
                  </tr>
                `
                )
                .join("")}
            </tbody>
          </table>
          <div class="text-base font-bold mt-5">
            Total Marks: ${totalMarks}
          </div>
        </div>
      </body>
      </html>
    `;
    browser = await puppeteer.launch({
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
    browser = null;
    const filename = `marksheet_${id}_${exam}_${year}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (error) {
    console.error("Error in generateMarksheetController:", error);
    if (browser) {
      await browser
        .close()
        .catch((e) => console.error("Error closing browser:", e));
    }
    res.status(500).json({
      error: "Error generating marksheet",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const previewMarksheetController = async (req, res) => {
  try {
    const { id, year } = req.params;
    console.log("=== PREVIEW MARKSHEET CONTROLLER START ===");
    
    const marks = await prisma.marks.findMany({
      where: {
        enrollment: {
          id: parseInt(id),
          year: parseInt(year),
        },
      },
      include: {
        enrollment: {
          include: {
            student: {
              select: {
                name: true,
              },
            },
          },
        },
        subject: {
          select: {
            name: true,
          },
        },
        exam: {
          select: {
            exam_name: true,
          },
        },
      },
    });
    console.log(`Found ${marks.length} marks records for student ID ${id} and year ${year}`);
    
    if (marks.length === 0) {
      return res.status(404).json({ message: "No marks found" });
    }
    const groupedData = {};
    const totalMarksByExam = {};
    marks.forEach((mark) => {
      const subjectName = mark.subject.name;
      const examName = mark.exam.exam_name;
      if (!groupedData[subjectName]) {
        groupedData[subjectName] = {
          student_name: mark.enrollment.student.name,
          subject: subjectName,
          class: mark.enrollment.class,
          roll: mark.enrollment.roll,
          year: mark.enrollment.year,
          final_merit: mark.enrollment.final_merit,
          exam_marks: {},
        };
      }
      groupedData[subjectName].exam_marks[examName] = mark.marks;
      if (!totalMarksByExam[examName]) {
        totalMarksByExam[examName] = 0;
      }
      totalMarksByExam[examName] += mark.marks;
    });
    const result = Object.values(groupedData).map((subject) => ({
      ...subject,
      total_marks_per_exam: totalMarksByExam,
    }));
    res.status(200).json(result);
  } catch (error) {
    console.error("Error in previewMarksheetController:", error);
    res.status(500).json({
      error: "Error generating preview",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const downloadPreviewMarksheet = async (req, res) => {
  try {
    const { id, year } = req.params;
    const marks = await prisma.marks.findMany({
      where: {
        enrollment: {
          student_id: parseInt(id),
          year: parseInt(year),
        },
      },
      include: {
        enrollment: {
          include: {
            student: {
              select: {
                name: true,
              },
            },
          },
        },
        subject: {
          select: {
            name: true,
          },
        },
        exam: {
          select: {
            exam_name: true,
          },
        },
      },
    });
    if (marks.length === 0) {
      return res.status(404).json({ message: "No marks found" });
    }
    const groupedData = {};
    const totalMarksByExam = {};
    const exams = new Set();
    marks.forEach((mark) => {
      const subjectName = mark.subject.name;
      const examName = mark.exam.exam_name;
      exams.add(examName);
      if (!groupedData[subjectName]) {
        groupedData[subjectName] = {
          student_name: mark.enrollment.student.name,
          subject: subjectName,
          class: mark.enrollment.class,
          roll: mark.enrollment.roll,
          year: mark.enrollment.year,
          exam_marks: {},
        };
      }
      groupedData[subjectName].exam_marks[examName] = mark.marks;
      if (!totalMarksByExam[examName]) {
        totalMarksByExam[examName] = 0;
      }
      totalMarksByExam[examName] += mark.marks;
    });
    const studentData = Object.values(groupedData);
    const studentName = studentData[0].student_name;
    const studentClass = studentData[0].class;
    const studentRoll = studentData[0].roll;
    const examsList = Array.from(exams);
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
                ${examsList
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
                    ${examsList
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
                ${examsList
                  .map((exam) => {
                    const total = totalMarksByExam[exam];
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
    console.error("Error in downloadPreviewMarksheet:", error);
    res.status(500).json({
      error: "Error downloading preview marksheet",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const downloadAllMarksheetPDF = async (req, res) => {
  try {
    const { year } = req.params;
    const marks = await prisma.marks.findMany({
      where: {
        enrollment: {
          year: parseInt(year),
        },
      },
      include: {
        enrollment: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        subject: {
          select: {
            name: true,
          },
        },
        exam: {
          select: {
            exam_name: true,
          },
        },
      },
      orderBy: [
        {
          enrollment: {
            student: {
              name: "asc",
            },
          },
        },
        {
          subject: {
            name: "asc",
          },
        },
      ],
    });
    if (marks.length === 0) {
      return res.status(404).json({ message: "No marks found" });
    }
    const grouped = {};
    const totalMarksByStudentExam = {};
    marks.forEach((mark) => {
      const studentId = mark.enrollment.student.id;
      const examName = mark.exam.exam_name;
      const key = `${studentId}_${examName}`;
      if (!grouped[studentId]) {
        grouped[studentId] = {
          student_id: studentId,
          student_name: mark.enrollment.student.name,
          class: mark.enrollment.class,
          roll: mark.enrollment.roll,
          year: mark.enrollment.year,
          final_merit: mark.enrollment.final_merit,
          subjects: [],
          exam_marks: {},
        };
      }
      let subject = grouped[studentId].subjects.find(
        (s) => s.subject === mark.subject.name
      );
      if (!subject) {
        subject = {
          subject: mark.subject.name,
          exam_marks: {},
        };
        grouped[studentId].subjects.push(subject);
      }
      subject.exam_marks[examName] = mark.marks;
      if (!totalMarksByStudentExam[key]) {
        totalMarksByStudentExam[key] = 0;
      }
      totalMarksByStudentExam[key] += mark.marks;
    });
    Object.values(grouped).forEach((student) => {
      const examHeaders = new Set();
      student.subjects.forEach((subject) => {
        Object.keys(subject.exam_marks).forEach((exam) =>
          examHeaders.add(exam)
        );
      });
      const totalMarks = {};
      Array.from(examHeaders).forEach((exam) => {
        const key = `${student.student_id}_${exam}`;
        totalMarks[exam] = totalMarksByStudentExam[key] || 0;
      });
      student.total_marks_per_exam = totalMarks;
    });
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
    console.error("Error in downloadAllMarksheetPDF:", error);
    res.status(500).json({
      error: "Error generating all marksheets PDF",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const addGPAController = async (req, res) => {
  try {
    console.log("=== ADD GPA CONTROLLER START ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    const { students, examName } = req.body;
    if (!examName) {
      return res.status(400).json({
        success: false,
        error: "examName is required",
      });
    }
    if (!Array.isArray(students)) {
      return res.status(400).json({
        success: false,
        error: "students must be an array",
      });
    }
    const results = [];
    const errors = [];
    for (const student of students) {
      try {
        console.log(
          `Processing student GPA: ${student.studentId}, GPA: ${student.gpa}`
        );
        if (!student.studentId) {
          errors.push("Student ID is required");
          continue;
        }
        if (student.gpa === undefined || student.gpa === null) {
          errors.push(`GPA is required for student ${student.studentId}`);
          continue;
        }
        const gpaValue = parseFloat(student.gpa);
        if (isNaN(gpaValue)) {
          errors.push(
            `Invalid GPA value for student ${student.studentId}: ${student.gpa}`
          );
          continue;
        }
        const studentExists = await prisma.students.findUnique({
          where: { id: student.studentId },
        });
        if (!studentExists) {
          errors.push(`Student ${student.studentId} not found`);
          continue;
        }
        let result;
        if (examName === "JSC") {
          result = await prisma.gpa.upsert({
            where: { student_id: student.studentId },
            create: {
              jsc_gpa: gpaValue,
              student_id: student.studentId,
            },
            update: {
              jsc_gpa: gpaValue,
            },
          });
        } else if (examName === "SSC") {
          result = await prisma.gpa.upsert({
            where: { student_id: student.studentId },
            create: {
              ssc_gpa: gpaValue,
              student_id: student.studentId,
            },
            update: {
              ssc_gpa: gpaValue,
            },
          });
        } else {
          errors.push(`Invalid exam name: ${examName}. Must be JSC or SSC`);
          continue;
        }
        console.log(
          `Successfully processed GPA for student ${student.studentId}:`,
          result
        );
        results.push(result);
      } catch (error) {
        const errorMsg = `Error processing student ${student.studentId}: ${error.message}`;
        console.error(errorMsg, error);
        errors.push(errorMsg);
      }
    }
    const response = {
      success: true,
      message: `Processed ${results.length} GPA records`,
      count: results.length,
      errors: errors.length > 0 ? errors : undefined,
    };
    console.log("GPA Controller response:", response);
    res.status(200).json(response);
  } catch (error) {
    console.error("Error in addGPAController:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

export const getAllStudentsGPAController = async (req, res) => {
  try {
    const { year } = req.params;
    if (!year || isNaN(parseInt(year))) {
      return res.status(400).json({
        success: false,
        error: "Invalid year parameter",
      });
    }
    const result = await prisma.student_enrollments.findMany({
      where: {
        year: parseInt(year),
      },
      include: {
        student: {
          include: {
            gpa: {
              select: {
                jsc_gpa: true,
                ssc_gpa: true,
              },
            },
          },
        },
      },
      orderBy: [
        {
          class: "asc",
        },
        {
          roll: "asc",
        },
      ],
    });
    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No students found for the specified year",
      });
    }
    const formattedResult = result.map((enrollment) => ({
      student_id: enrollment.student.id,
      student_name: enrollment.student.name,
      class: enrollment.class,
      roll: enrollment.roll,
      department: enrollment.department,
      section: enrollment.section,
      jsc_gpa: enrollment.student.gpa?.jsc_gpa || null,
      ssc_gpa: enrollment.student.gpa?.ssc_gpa || null,
    }));
    res.status(200).json({
      success: true,
      data: formattedResult,
    });
  } catch (error) {
    console.error("Error in getAllStudentsGPAController:", error);
    res.status(500).json({
      success: false,
      error: "Error fetching all students' GPA",
      details: error.message,
    });
  }
};
