import fs from "fs";
import path from "path";
import generatePassword from "@/utils/pwgenerator.js";
import bcrypt from "bcryptjs";
import { prisma } from "@/config/prisma.js";
import { deleteFromR2 } from "@/config/r2.js";
import { sheets, spreadsheetId } from "@/config/sheet.js";
import { VALID_DEPARTMENTS } from "@school/shared-schemas";
import { ApiError } from "@/utils/ApiError.js";
import puppeteer from "puppeteer";

const current_year = new Date().getFullYear();
const removeInitialZeros = (str) => str.replace(/^0+/, "");

export const sanitizeStudent = (student) => {
  const { password: _password, ...rest } = student;
  return rest;
};

const columnMapping = {
  login_id: 0,
  name: 1,
  father_phone: 2,
  originalPassword: 3,
  batch: 4,
};

const getColumnIndex = (field) => {
  return columnMapping[field] !== undefined ? columnMapping[field] : -1;
};

const updateSheetStudentData = async (loginId, updatesObject) => {
  try {
    const student = await prisma.students.findUnique({
      where: { login_id: Number(loginId) },
      select: { id: true, sheet_row_index: true },
    });

    if (!student) return;

    let targetRowIndex = -1;
    let currentRowData = [];

    if (student.sheet_row_index !== null) {
      const sheetData = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `students!A${student.sheet_row_index + 1}:Z${student.sheet_row_index + 1}`,
      });

      const rows = sheetData.data.values || [];
      if (
        rows.length > 0 &&
        String(rows[0][0]).trim() === String(loginId).trim()
      ) {
        targetRowIndex = student.sheet_row_index;
        currentRowData = rows[0];
      }
    }

    if (targetRowIndex === -1) {
      const sheetData = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "students!A1:Z",
      });

      const rows = sheetData.data.values || [];
      targetRowIndex = rows.findIndex(
        (row) => String(row[0]).trim() === String(loginId).trim(),
      );

      if (targetRowIndex !== -1) {
        currentRowData = rows[targetRowIndex];
        await prisma.students.update({
          where: { id: student.id },
          data: { sheet_row_index: targetRowIndex },
        });
      }
    }

    if (targetRowIndex !== -1) {
      const updatedRow = [...currentRowData];
      let hasChanges = false;
      Object.keys(updatesObject).forEach((key) => {
        const columnIndex = getColumnIndex(key);
        if (columnIndex !== -1) {
          updatedRow[columnIndex] = updatesObject[key];
          hasChanges = true;
        }
      });

      if (hasChanges) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `students!A${targetRowIndex + 1}:Z${targetRowIndex + 1}`,
          valueInputOption: "RAW",
          requestBody: {
            values: [updatedRow],
          },
        });
      }
    }
  } catch {
    /* silent */
  }
};

export class StudentService {
  static async getAlumni() {
    const students = await prisma.students.findMany();
    return students.map(sanitizeStudent);
  }

  static async getStudents(year, userOptions = {}) {
    let result = [];
    if (userOptions.role === "admin") {
      result = await prisma.students.findMany({
        include: {
          enrollments: {
            where: { year },
            orderBy: { year: "desc" },
          },
        },
      });
    } else if (userOptions.role === "teacher") {
      if (!userOptions.levels || userOptions.levels.length === 0) {
        return [];
      }
      const levelConditions = userOptions.levels.map((level) => ({
        class: level.class_name,
        section: level.section,
        year: level.year,
      }));

      result = await prisma.students.findMany({
        where: {
          enrollments: {
            some: {
              AND: [{ year }, { OR: levelConditions }],
            },
          },
        },
        include: {
          enrollments: {
            where: {
              AND: [{ year }, { OR: levelConditions }],
            },
            orderBy: { year: "desc" },
          },
        },
      });
    }

    return result.flatMap((student) => {
      const studentWithoutPassword = sanitizeStudent(student);
      return student.enrollments.map((enrollment) => ({
        ...enrollment,
        ...studentWithoutPassword,
        id: studentWithoutPassword.id,
        enrollment_id: enrollment.id,
      }));
    });
  }

  static async getStudentById(studentId) {
    const result = await prisma.students.findUnique({
      where: { id: studentId },
      include: {
        enrollments: {
          where: { year: new Date().getFullYear() },
          orderBy: { year: "desc" },
          take: 1,
        },
      },
    });

    if (!result || result.enrollments.length === 0) {
      throw new ApiError(404, "Student not found");
    }

    const studentWithoutPassword = sanitizeStudent(result);
    return {
      ...result.enrollments[0],
      ...studentWithoutPassword,
      id: studentWithoutPassword.id,
      enrollment_id: result.enrollments[0].id,
    };
  }

  static async addStudents(students) {
    const batchLoginIdMap = {};
    const usedLoginIds = new Set();
    const processedStudents = [];

    for (let i = 0; i < students.length; i++) {
      const student = { ...students[i] };

      let password = generatePassword();
      student.originalPassword = password;
      student.password = await bcrypt.hash(password, 10);

      const classNum = Number(removeInitialZeros(String(student.class || 1)));
      student.class = classNum;
      student.section = (student.section?.trim() || "A").toUpperCase();
      student.roll = Number(removeInitialZeros(String(student.roll || 1)));

      const batchYear = current_year + 11 - classNum;
      student.batch = String(batchYear);

      student.department =
        classNum >= 9 ? student.department?.trim() || null : null;

      if (
        (classNum === 9 || classNum === 10) &&
        !VALID_DEPARTMENTS.includes(student.department || "")
      ) {
        throw new ApiError(
          400,
          `Student at index ${i}: Department is required for class 9-10`,
        );
      }

      if (classNum < 9) {
        student.department = null;
      }
      student.year = student.year || current_year;

      if (!batchLoginIdMap[student.batch]) {
        const result = await prisma.students.findMany({
          where: { batch: student.batch },
          orderBy: { login_id: "desc" },
          take: 1,
        });

        batchLoginIdMap[student.batch] =
          result.length > 0 && result[0].login_id
            ? result[0].login_id + 1
            : parseInt(student.batch.toString().slice(-2) + "001");
      }

      student.login_id = batchLoginIdMap[student.batch];

      const existingRecord = await prisma.students.findUnique({
        where: { login_id: student.login_id },
        select: { id: true },
      });

      while (usedLoginIds.has(student.login_id) || existingRecord) {
        student.login_id += 1;
      }

      usedLoginIds.add(student.login_id);
      batchLoginIdMap[student.batch] = student.login_id + 1;

      processedStudents.push(student);
    }

    const insertedEnrollments = await prisma.$transaction(async (tx) => {
      const returnEnrollments = [];
      for (const student of processedStudents) {
        const insertedStudent = await tx.students.create({
          data: {
            login_id: student.login_id,
            name: student.name,
            father_name: student.father_name,
            mother_name: student.mother_name,
            father_phone: student.father_phone,
            mother_phone: student.mother_phone,
            batch: student.batch,
            village: student.village,
            post_office: student.post_office,
            upazila: student.upazila,
            district: student.district,
            dob: student.dob,
            has_stipend: student.has_stipend,
            password: student.password,
          },
        });

        const insertedEnrollment = await tx.student_enrollments.create({
          data: {
            student_id: insertedStudent.id,
            class: student.class,
            roll: student.roll,
            section: student.section,
            year: student.year,
            department: student.department,
          },
        });
        returnEnrollments.push(insertedEnrollment);
      }
      return returnEnrollments;
    });

    try {
      const sheetData = processedStudents.map((student) => [
        student.login_id,
        student.name,
        student.father_phone || "",
        student.originalPassword,
        student.batch,
      ]);

      const sheetResponse = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "students!A1",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: sheetData,
        },
      });

      const updatedRange = sheetResponse.data?.updates?.updatedRange;
      if (updatedRange) {
        const match = updatedRange.match(/!A(\d+)/);
        if (match && match[1]) {
          const startRowIndex = parseInt(match[1]) - 1;
          const updatesPromises = processedStudents.map((student, idx) => {
            return prisma.students.update({
              where: { login_id: student.login_id },
              data: { sheet_row_index: startRowIndex + idx },
            });
          });
          await Promise.all(updatesPromises);
        }
      }
    } catch {
      /* silent */
    }

    return {
      data: insertedEnrollments,
      inserted_count: processedStudents.length,
    };
  }

  static async updateStudent(id, updates) {
    const result = await prisma.students.update({
      where: { id },
      data: updates,
    });

    await updateSheetStudentData(result.login_id, updates);
    return sanitizeStudent(result);
  }

  static async deleteStudent(id) {
    const student = await prisma.students.findUnique({
      where: { id },
    });

    if (!student) {
      throw new ApiError(404, "Student not found");
    }

    const loginId = student.login_id;
    await prisma.students.delete({
      where: { id },
    });

    let targetRowIndex = -1;

    if (student.sheet_row_index !== null) {
      const sheetData = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `students!A${student.sheet_row_index + 1}:Z${student.sheet_row_index + 1}`,
      });
      const rows = sheetData.data.values || [];
      if (
        rows.length > 0 &&
        String(rows[0][0]).trim() === String(loginId).trim()
      ) {
        targetRowIndex = student.sheet_row_index;
      }
    }

    if (targetRowIndex === -1) {
      const sheetData = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "students!A1:Z",
      });
      const rows = sheetData.data.values || [];
      targetRowIndex = rows.findIndex(
        (row) => String(row[0]).trim() === String(loginId).trim(),
      );
    }

    if (targetRowIndex !== -1) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: 0,
                  dimension: "ROWS",
                  startIndex: targetRowIndex,
                  endIndex: targetRowIndex + 1,
                },
              },
            },
          ],
        },
      });
    }
  }

  static async deleteStudentsBulk(studentIds) {
    const students = await prisma.students.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, login_id: true },
    });

    if (students.length === 0) {
      throw new ApiError(404, "No matching students found");
    }

    await prisma.students.deleteMany({
      where: { id: { in: students.map((s) => s.id) } },
    });

    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "students!A1:Z",
    });

    const rows = sheetData.data.values || [];
    const loginIdSet = new Set(
      students.map((student) => String(student.login_id)),
    );
    const rowIndexes = rows
      .map((row, index) => (loginIdSet.has(String(row[0])) ? index : -1))
      .filter((index) => index !== -1)
      .sort((a, b) => b - a);

    if (rowIndexes.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: rowIndexes.map((rowIndex) => ({
            deleteDimension: {
              range: {
                sheetId: 0,
                dimension: "ROWS",
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          })),
        },
      });
    }

    return students.length;
  }

  static async updateAcademicInfo(enrollmentId, updates) {
    const classForValidation =
      updates.class ??
      (
        await prisma.student_enrollments.findUnique({
          where: { id: enrollmentId },
          select: { class: true },
        })
      )?.class;

    if (
      (classForValidation === 9 || classForValidation === 10) &&
      (!updates.department || !VALID_DEPARTMENTS.includes(updates.department))
    ) {
      throw new ApiError(
        400,
        "Department is required for class 9-10 and must be valid.",
      );
    }

    if (classForValidation !== 9 && classForValidation !== 10) {
      updates.department = null;
    }

    const result = await prisma.$transaction(async (tx) => {
      const enrollment = await tx.student_enrollments.update({
        where: { id: enrollmentId },
        data: updates,
      });

      if (!enrollment) throw new ApiError(404, "Enrollment record not found");

      const studentInfo = await tx.students.findUnique({
        where: { id: enrollment.student_id },
        select: { batch: true, login_id: true, id: true },
      });

      if (!studentInfo) throw new ApiError(404, "Student not found");

      const oldBatch = parseInt(studentInfo.batch);
      const currentLoginId = studentInfo.login_id;
      const currentYear = new Date().getFullYear();
      const newBatch = currentYear + 11 - enrollment.class;

      let newLoginId = currentLoginId;
      let updatedStudent = null;

      if (newBatch !== oldBatch) {
        const maxLoginResult = await tx.students.findMany({
          where: { batch: String(newBatch) },
          orderBy: { login_id: "desc" },
          take: 1,
        });

        const maxLoginId =
          maxLoginResult.length > 0 ? maxLoginResult[0].login_id : null;
        newLoginId = maxLoginId
          ? maxLoginId + 1
          : parseInt(newBatch.toString().slice(-2) + "001");

        updatedStudent = await tx.students.update({
          where: { id: enrollment.student_id },
          data: {
            batch: String(newBatch),
            login_id: newLoginId,
          },
        });
      }

      return {
        enrollment,
        updatedStudent,
        oldLoginId: currentLoginId,
        newLoginId,
      };
    });

    if (result.updatedStudent) {
      await updateSheetStudentData(result.oldLoginId, {
        login_id: result.newLoginId,
        batch: result.updatedStudent.batch,
      });
    }

    return result.enrollment;
  }

  static async saveStudentImage(id, key) {
    const existingStudent = await prisma.students.findUnique({
      where: { id },
    });
    if (!existingStudent) {
      throw new ApiError(404, "Student not found");
    }
    if (existingStudent.image) {
      await deleteFromR2(existingStudent.image);
    }
    return prisma.students.update({
      where: { id },
      data: { image: key || null },
    });
  }

  static async changePassword(studentId, currentPassword, newPassword) {
    const student = await prisma.students.findUnique({
      where: { id: studentId },
    });
    if (!student) {
      throw new ApiError(404, "Student not found");
    }
    const isMatch = await bcrypt.compare(currentPassword, student.password);
    if (!isMatch) {
      throw new ApiError(400, "Current password is incorrect");
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await prisma.students.update({
      where: { id: studentId },
      data: { password: hashedNewPassword },
    });

    await updateSheetStudentData(student.login_id, {
      originalPassword: newPassword,
    });
  }

  static async getClassStudents(year, level) {
    const currentYear = new Date().getFullYear();
    if (year < 2000 || year > currentYear + 5) {
      throw new ApiError(
        400,
        `Invalid year. Year must be between 2000 and ${currentYear + 5}.`,
      );
    }

    const result = await prisma.students.findMany({
      include: {
        enrollments: {
          where: { year, class: level },
          orderBy: { year: "desc" },
        },
      },
    });

    if (result.length === 0) {
      throw new ApiError(404, "No students found for the specified year");
    }

    return result.flatMap((student) => {
      const studentWithoutPassword = sanitizeStudent(student);
      return student.enrollments.map((enrollment) => ({
        ...enrollment,
        ...studentWithoutPassword,
        id: studentWithoutPassword.id,
        enrollment_id: enrollment.id,
      }));
    });
  }

  static async generateTestimonials(id) {
    const student = await prisma.students.findUnique({
      where: { id: parseInt(id) },
      include: {
        enrollments: {
          orderBy: { year: "desc" },
          take: 1,
        },
      },
    });

    if (!student) {
      throw new ApiError(404, "Student not found");
    }

    const data = {
      school_name: "Panchbibi Lal Mohammad Pilot Govt. High School",
      school_location: "Panchbibi, Joypurhat",
      school_website: "https://panchbibilal.edu.bd",
      name: student.name,
      father_name: student.father_name,
      mother_name: student.mother_name,
      roll: student.enrollments[0]?.roll || "N/A",
      class: student.enrollments[0]?.class || "N/A",
      section: student.enrollments[0]?.section || "N/A",
      session: student.enrollments[0]?.year || "N/A",
      batch: student.batch || "N/A",
    };

    return await generatePDF(data);
  }
}

async function generatePDF(data) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            body {
                font-family: 'Times New Roman', Times, serif;
                padding: 40px;
                line-height: 1.6;
                color: #333;
            }
            .certificate-container {
                border: 10px double #2c3e50;
                padding: 50px;
                text-align: center;
                position: relative;
                min-height: 800px;
            }
            .header h1 {
                margin: 0;
                font-size: 28px;
                text-transform: uppercase;
                color: #1a252f;
            }
            .header p {
                margin: 5px 0;
                font-size: 16px;
            }
            .title {
                margin-top: 50px;
                font-size: 36px;
                text-decoration: underline;
                font-weight: bold;
                letter-spacing: 2px;
            }
            .content {
                margin-top: 60px;
                text-align: justify;
                font-size: 20px;
            }
            .student-info {
                font-weight: bold;
                border-bottom: 1px dotted #000;
                display: inline-block;
                padding: 0 5px;
            }
            .footer {
                margin-top: 150px;
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
            }
            .signature-box {
                text-align: center;
                width: 250px;
                border-top: 1.5px solid #000;
                padding-top: 8px;
                font-weight: bold;
            }
            .date {
                font-style: italic;
            }
        </style>
    </head>
    <body>
        <div class="certificate-container">
            <div class="header">
                <h1>${data.school_name}</h1>
                <p>${data.school_location}</p>
                <p>Website: ${data.school_website}</p>
            </div>

            <div class="title">TESTIMONIAL</div>

            <div class="content">
                This is to certify that <span class="student-info">${data.name}</span>, 
                son/daughter of <span class="student-info">${data.father_name}</span> 
                and <span class="student-info">${data.mother_name}</span>, was a student of this institution. 
                He/She was enrolled in Class <span class="student-info">${data.class}</span>, 
                Section <span class="student-info">${data.section}</span> with Roll No. <span class="student-info">${data.roll}</span> 
                during the academic session <span class="student-info">${data.session}</span>.
                His/Her batch was <span class="student-info">${data.batch}</span>.
                <br><br>
                To the best of my knowledge, he/she bears a good moral character and 
                took active part in co-curricular activities. I wish him/her every success in life.
            </div>

            <div class="footer">
                <div class="date">
                    Date: ${new Date().toLocaleDateString()}
                </div>
                <div class="signature-box">
                    Headmaster
                </div>
            </div>
        </div>
    </body>
    </html>
  `;

  await page.setContent(htmlContent, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "30px", right: "30px", bottom: "30px", left: "30px" },
  });

  await browser.close();

  const outputPath = path.join(process.cwd(), "output.pdf");
  fs.writeFileSync(outputPath, pdfBuffer);

  return {
    message: "PDF generated successfully",
    path: outputPath,
  };
}
