import { prisma } from "@/config/prisma.js";
import puppeteer from "puppeteer";

export class MarksService {
  private static validateMarksData(data: any) {
    if (!Array.isArray(data.students)) {
      throw new Error("Students data must be an array");
    }
    data.students.forEach((student: any) => {
      if (!student.studentId || !Array.isArray(student.subjectMarks)) {
        throw new Error("Invalid student data structure");
      }
      student.subjectMarks.forEach((mark: any) => {
        if (!mark.subjectId) {
          throw new Error("Invalid marks data structure - missing subjectId");
        }
        mark.cq_marks = Math.max(0, parseInt(mark.cq_marks) || 0);
        mark.mcq_marks = Math.max(0, parseInt(mark.mcq_marks) || 0);
        mark.practical_marks = Math.max(0, parseInt(mark.practical_marks) || 0);
        mark.marks = Math.max(0, parseInt(mark.marks) || 0);
      });
    });
  }

  private static checkTeacherAccess(user: any, className: number, section: string, year: number) {
    if (user.role === "admin") return true;
    if (user.role === "teacher") {
      return user.levels?.some(
        (level: any) =>
          level.class_name === className &&
          level.section === section &&
          level.year === year,
      );
    }
    return false;
  }

  static async addMarks(data: any, user: any) {
    this.validateMarksData(data);
    const { students, examName, year } = data;

    const exam = await prisma.exams.findFirst({
      where: {
        exam_name: examName,
        exam_year: parseInt(year),
      },
    });

    if (!exam) {
      const allExams = await prisma.exams.findMany({
        select: { id: true, exam_name: true, exam_year: true },
      });
      throw new Error(
        `Exam "${examName}" not found for year ${year}. Available: ${JSON.stringify(allExams)}`,
      );
    }

    const results = [];
    const errors = [];

    for (const student of students) {
      try {
        const enrollment = await prisma.student_enrollments.findFirst({
          where: {
            student_id: student.studentId,
            year: parseInt(year),
          },
        });

        if (!enrollment) {
          errors.push(`Student ${student.studentId} not enrolled in ${year}`);
          continue;
        }

        // Check teacher access
        if (
          !this.checkTeacherAccess(
            user,
            enrollment.class,
            enrollment.section,
            parseInt(year),
          )
        ) {
          errors.push(
            `Teacher ${user.id} not authorized for Class ${enrollment.class} Section ${enrollment.section}`,
          );
          continue;
        }

        for (const {
          subjectId,
          cq_marks,
          mcq_marks,
          practical_marks,
          marks: providedTotal,
        } of student.subjectMarks) {
          try {
            const subject = await prisma.subjects.findUnique({
              where: { id: subjectId },
            });

            if (!subject) {
              errors.push(`Subject ${subjectId} not found`);
              continue;
            }

            const totalMarks = (subject as any).marking_scheme === "BREAKDOWN"
              ? (cq_marks || 0) + (mcq_marks || 0) + (practical_marks || 0)
              : (providedTotal || 0);

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

            let result;
            if (existingMark) {
              result = await prisma.marks.update({
                where: { id: existingMark.id },
                data: markData,
              });
            } else {
              result = await prisma.marks.create({
                data: {
                  enrollment_id: enrollment.id,
                  subject_id: subjectId,
                  exam_id: exam.id,
                  ...markData,
                },
              });
            }
            results.push(result);
          } catch (error: any) {
            errors.push(
              `Failed to process student ${student.studentId} subject ${subjectId}: ${error.message}`,
            );
          }
        }
      } catch (error: any) {
        errors.push(
          `Error processing student ${student.studentId}: ${error.message}`,
        );
      }
    }

    return {
      success: true,
      count: results.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  static async getStudentsForMarks(
    className: string,
    year: string,
    section: string | undefined,
    user: any,
  ) {
    const where: any = {
      class: Number(className),
      year: parseInt(year),
    };

    if (user.role === "teacher") {
      const assignedSections = user.levels
        ?.filter(
          (l: any) =>
            l.class_name === Number(className) && l.year === parseInt(year),
        )
        .map((l: any) => l.section);

      if (!assignedSections || assignedSections.length === 0) {
        throw new Error("You are not assigned to this class.");
      }

      if (section) {
        if (!assignedSections.includes(section)) {
          throw new Error("You are not assigned to this section.");
        }
        where.section = section;
      } else {
        where.section = { in: assignedSections };
      }
    } else if (section) {
      where.section = section;
    }

    const students = await prisma.student_enrollments.findMany({
      where,
      include: {
        student: { select: { id: true, name: true } },
      },
      orderBy: [{ roll: "asc" }, { student: { name: "asc" } }],
    });

    return students.map((enrollment) => ({
      student_id: enrollment.student.id,
      name: enrollment.student.name,
      roll: enrollment.roll,
      class: enrollment.class,
      section: enrollment.section,
      group: enrollment.group,
    }));
  }

  static async getClassMarks(
    className: string,
    year: string,
    exam: string,
    user: any,
  ) {
    const where: any = {
      class: Number(className),
      year: parseInt(year),
    };

    if (user.role === "teacher") {
      const assignedSections = user.levels
        ?.filter(
          (l: any) =>
            l.class_name === Number(className) && l.year === parseInt(year),
        )
        .map((l: any) => l.section);

      if (!assignedSections || assignedSections.length === 0) {
        throw new Error("You are not assigned to this class.");
      }
      where.section = { in: assignedSections };
    }

    const result = await prisma.student_enrollments.findMany({
      where,
      include: {
        student: { select: { id: true, name: true } },
        marks: {
          where: { exam: { exam_name: exam } },
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
            exam: { select: { exam_name: true } },
          },
        },
      },
      orderBy: [{ roll: "asc" }, { student: { name: "asc" } }],
    });

    if (result.length === 0) {
      throw new Error(
        "No marks found for the specified class, year, and exam.",
      );
    }

    return result.map((enrollment) => ({
      student_id: enrollment.student.id,
      name: enrollment.student.name,
      roll: enrollment.roll,
      class: enrollment.class,
      group: enrollment.group,
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
  }

  static async getIndividualMarks(
    id: string,
    year: string,
    exam: string,
    user: any,
  ) {
    const studentId = parseInt(id);
    const yearInt = parseInt(year);

    const enrollment = await prisma.student_enrollments.findFirst({
      where: { student_id: studentId, year: yearInt },
    });

    if (!enrollment) {
      throw new Error("Student enrollment not found for specified year");
    }

    if (!this.checkTeacherAccess(user, enrollment.class, enrollment.section, yearInt)) {
      throw new Error("You are not authorized to view this student's marks");
    }

    const result = await prisma.marks.findMany({
      where: {
        enrollment_id: enrollment.id,
        exam: { exam_name: exam },
      },
      include: {
        enrollment: { include: { student: { select: { name: true } } } },
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
        exam: { select: { exam_name: true } },
      },
    });

    if (result.length === 0) {
      const studentExists = await prisma.students.findUnique({
        where: { id: studentId },
      });
      if (!studentExists) throw new Error("Student not found");

      const enrollmentExists = await prisma.student_enrollments.findFirst({
        where: { student_id: studentId, year: yearInt },
      });
      if (!enrollmentExists)
        throw new Error("Student not enrolled for the specified year");

      const examExists = await prisma.exams.findFirst({
        where: { exam_name: exam },
      });
      if (!examExists) throw new Error("Exam not found");

      throw new Error("No marks found for this student, year, and exam");
    }

    return result.map((mark) => ({
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
  }

  static async generateMarksheetPDF(
    id: string,
    year: string,
    exam: string,
    user: any,
  ) {
    const result = await prisma.marks.findMany({
      where: {
        enrollment: { student_id: parseInt(id), year: parseInt(year) },
        exam: { exam_name: exam },
      },
      include: {
        enrollment: { include: { student: { select: { name: true } } } },
        subject: { select: { name: true } },
        exam: { select: { exam_name: true } },
      },
    });

    if (result.length === 0) throw new Error("No marks found for the student");

    const enrollment = result[0].enrollment;
    if (
      !this.checkTeacherAccess(
        user,
        enrollment.class,
        enrollment.section,
        parseInt(year),
      )
    ) {
      throw new Error("You are not authorized to download this marksheet");
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
              ${result.map((mark) => `<tr><td class="border border-gray-300 p-2">${mark.subject.name}</td><td class="border border-gray-300 p-2">${mark.marks}</td></tr>`).join("")}
            </tbody>
          </table>
          <div class="text-base font-bold mt-5">Total Marks: ${totalMarks}</div>
        </div>
      </body>
      </html>
    `;

    return await this.generatePDF(html);
  }

  static async previewMarksheet(id: string, year: string, user: any) {
    const marks = await prisma.marks.findMany({
      where: { enrollment: { student_id: parseInt(id), year: parseInt(year) } },
      include: {
        enrollment: { include: { student: { select: { name: true } } } },
        subject: { select: { name: true } },
        exam: { select: { exam_name: true } },
      },
    });

    if (marks.length === 0) throw new Error("No marks found");

    const enrollment = marks[0].enrollment;
    if (
      !this.checkTeacherAccess(
        user,
        enrollment.class,
        enrollment.section,
        parseInt(year),
      )
    ) {
      throw new Error("You are not authorized to preview this marksheet");
    }

    const groupedData: any = {};
    const totalMarksByExam: any = {};

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
      totalMarksByExam[examName] =
        (totalMarksByExam[examName] || 0) + mark.marks;
    });

    return Object.values(groupedData).map((subject: any) => ({
      ...subject,
      total_marks_per_exam: totalMarksByExam,
    }));
  }

  static async generatePreviewPDF(id: string, year: string, user: any) {
    const marks = await prisma.marks.findMany({
      where: { enrollment: { student_id: parseInt(id), year: parseInt(year) } },
      include: {
        enrollment: { include: { student: { select: { name: true } } } },
        subject: { select: { name: true } },
        exam: { select: { exam_name: true } },
      },
    });

    if (marks.length === 0) throw new Error("No marks found");

    const enrollment = marks[0].enrollment;
    if (
      !this.checkTeacherAccess(
        user,
        enrollment.class,
        enrollment.section,
        parseInt(year),
      )
    ) {
      throw new Error("You are not authorized to download this preview");
    }

    const groupedData: any = {};
    const totalMarksByExam: any = {};
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
      totalMarksByExam[examName] =
        (totalMarksByExam[examName] || 0) + mark.marks;
    });

    const studentData = Object.values(groupedData) as any[];
    const examsList = Array.from(exams) as string[];
    const studentName = studentData[0].student_name;
    const studentClass = studentData[0].class;
    const studentRoll = studentData[0].roll;

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
            <div><p><strong>Name:</strong> ${studentName}</p><p><strong>Class:</strong> ${studentClass}</p></div>
            <div><p><strong>Roll No:</strong> ${studentRoll}</p><p><strong>Year:</strong> ${year}</p></div>
          </div>
          <table class="table-auto w-full border-collapse border border-gray-300 mb-6">
            <thead>
              <tr class="bg-gray-200 text-center">
                <th class="border border-gray-300 px-4 py-2 text-left">Subject</th>
                ${examsList.map((exam) => `<th class="border border-gray-300 px-4 py-2">${exam}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${studentData
                .map(
                  (row) => `
                <tr>
                  <td class="border border-gray-300 px-4 py-2">${row.subject}</td>
                  ${examsList.map((exam) => `<td class="border text-center border-gray-300 px-4 py-2">${row.exam_marks[exam] ?? "-"}</td>`).join("")}
                </tr>`,
                )
                .join("")}
              <tr class="bg-gray-100 font-semibold">
                <td class="border border-gray-300 px-4 py-2 text-right">Total</td>
                ${examsList.map((exam) => `<td class="border text-center border-gray-300 px-4 py-2">${totalMarksByExam[exam] ?? "-"}</td>`).join("")}
              </tr>
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `;

    return { buffer: await this.generatePDF(html), studentName };
  }

  static async generateAllMarksheetsPDF(year: string) {
    const marks = await prisma.marks.findMany({
      where: { enrollment: { year: parseInt(year) } },
      include: {
        enrollment: {
          include: { student: { select: { id: true, name: true } } },
        },
        subject: { select: { name: true } },
        exam: { select: { exam_name: true } },
      },
      orderBy: [
        { enrollment: { student: { name: "asc" } } },
        { subject: { name: "asc" } },
      ],
    });

    if (marks.length === 0) throw new Error("No marks found");

    const grouped: any = {};
    const totalMarksByStudentExam: any = {};

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
        };
      }
      let subject = grouped[studentId].subjects.find(
        (s: any) => s.subject === mark.subject.name,
      );
      if (!subject) {
        subject = { subject: mark.subject.name, exam_marks: {} };
        grouped[studentId].subjects.push(subject);
      }
      subject.exam_marks[examName] = mark.marks;
      totalMarksByStudentExam[key] =
        (totalMarksByStudentExam[key] || 0) + mark.marks;
    });

    const allMarksheetHTML = Object.values(grouped)
      .map((student: any) => {
        const examHeaders = Object.keys(student.subjects[0]?.exam_marks || {});
        return `
        <div class="max-w-4xl mx-auto bg-white rounded-lg p-6 page-break">
          <div class="text-center mb-6">
            <h2 class="text-2xl font-bold">PANCHBIBI LAL BIHARI PILOT GOVT. HIGH SCHOOL</h2>
            <p class="italic">Panchbibi, Joypurhat</p>
          </div>
          <div class="flex justify-between mb-4">
            <div><p><strong>Name:</strong> ${student.student_name}</p><p><strong>Class:</strong> ${student.class}</p></div>
            <div><p><strong>Roll No:</strong> ${student.roll}</p><p><strong>Year:</strong> ${student.year}</p></div>
            <div><p><strong>Final Merit:</strong> ${student.final_merit || "-"}</p></div>
          </div>
          <table class="table-auto w-full border-collapse border border-gray-300 mb-6">
            <thead>
              <tr class="bg-gray-200"><th class="border border-gray-300 px-4 py-2">Subject</th>${examHeaders.map((exam) => `<th class="border border-gray-300 px-4 py-2">${exam}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${student.subjects.map((sub: any) => `<tr><td class="border border-gray-300 px-4 py-2">${sub.subject}</td>${examHeaders.map((exam) => `<td class="border text-center border-gray-300 px-4 py-2">${sub.exam_marks[exam]}</td>`).join("")}</tr>`).join("")}
              <tr class="bg-gray-100 font-semibold"><td class="border border-gray-300 px-4 py-2 text-right">Total</td>${examHeaders.map((exam) => `<td class="border text-center border-gray-300 px-4 py-2">${totalMarksByStudentExam[`${student.student_id}_${exam}`] || 0}</td>`).join("")}</tr>
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
        <style>.page-break { page-break-after: always; }</style>
      </head>
      <body>${allMarksheetHTML}</body>
      </html>
    `;

    return await this.generatePDF(finalHTML);
  }

  private static async generatePDF(html: string) {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const buffer = await page.pdf({
        format: "A4",
        margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
        printBackground: true,
      });
      return buffer;
    } finally {
      await browser.close();
    }
  }
}
