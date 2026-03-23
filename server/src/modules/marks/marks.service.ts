import { prisma } from "@/config/prisma.js";
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";

const PDF_STYLES = {
  startX: 50,
  contentWidth: 495,
  rowHeight: 20,
  headerFontSize: 10,
  rowFontSize: 9,
  fontBold: "Times-Bold",
  fontRegular: "Times-Roman",
  fontItalic: "Times-Italic",
}; 

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
        mark.cq_marks = mark.cq_marks === null || mark.cq_marks === undefined ? null : Math.max(0, parseInt(mark.cq_marks));
        mark.mcq_marks = mark.mcq_marks === null || mark.mcq_marks === undefined ? null : Math.max(0, parseInt(mark.mcq_marks));
        mark.practical_marks = mark.practical_marks === null || mark.practical_marks === undefined ? null : Math.max(0, parseInt(mark.practical_marks));
        mark.marks = mark.marks === null || mark.marks === undefined ? null : Math.max(0, parseInt(mark.marks));
      });
    }); 
  }

  private static checkAccess(user: any, studentId: number, className: number, section: string, year: number) {
    if (user.role === "admin") return true;
    if (user.role === "teacher") {
      return user.levels?.some(
        (level: any) =>
          level.class_name === className &&
          level.section === section &&
          level.year === year,
      );
    }
    if (user.role === "student") {
      return user.id === studentId;
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

        // Check access
        if (
          !this.checkAccess(
            user,
            student.studentId,
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

            let totalMarks: number | null = (subject as any).marking_scheme === "BREAKDOWN"
              ? (Number(cq_marks) || 0) + (Number(mcq_marks) || 0) + (Number(practical_marks) || 0)
              : providedTotal;

            if ((subject as any).marking_scheme === "BREAKDOWN" && cq_marks === null && mcq_marks === null && practical_marks === null) {
              totalMarks = null;
            }

            const existingMark = await prisma.marks.findFirst({
              where: {
                enrollment_id: enrollment.id,
                subject_id: subjectId,
                exam_id: exam.id,
              },
            });

            const markData = {
              cq_marks: cq_marks,
              mcq_marks: mcq_marks,
              practical_marks: practical_marks,
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

    return students.map((enrollment: any) => ({
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
                marking_scheme: true,
              },
            },
            exam: { select: { exam_name: true } },
          },
        },
      },
      orderBy: [{ roll: "asc" }, { student: { name: "asc" } }],
    });

    if (result.length === 0) {
      return [];
    }

    return result.map((enrollment: any) => ({
      student_id: enrollment.student.id,
      name: enrollment.student.name,
      roll: enrollment.roll,
      class: enrollment.class,
      group: enrollment.group,
      section: enrollment.section,
      marks: enrollment.marks
        .filter((mark: any) => mark.marks !== null)
        .map((mark: any) => ({
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
            marking_scheme: (mark.subject as any).marking_scheme,
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

    if (!this.checkAccess(user, studentId, enrollment.class, enrollment.section, yearInt)) {
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

    return result
      .filter((mark: any) => mark.marks !== null)
      .map((mark: any) => ({
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

  static async generateMarksheetPDF(id: string, year: string, exam: string, user: any) {
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
    if (!this.checkAccess(user, parseInt(id), enrollment.class, enrollment.section, parseInt(year))) {
      throw new Error("You are not authorized to download this marksheet");
    }

    const studentName = result[0].enrollment.student.name;
    const studentClass = result[0].enrollment.class;
    const studentRoll = result[0].enrollment.roll;

    const studentDetails = {
      name: studentName,
      class: studentClass,
      roll: studentRoll,
      year: parseInt(year),
      exam: exam,
    };

    const tableData = result
      .filter((mark) => mark.marks !== null)
      .map((mark) => ({
        subject: mark.subject.name,
        marks: mark.marks,
      }));

    const buffer = await this.renderStudentReportPDF(studentDetails, tableData);
    return { buffer, studentName };
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

    marks.forEach((mark: any) => {
      if (mark.marks === null) return;
      
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
      let subject = grouped[studentId].subjects.find((s: any) => s.subject === mark.subject.name);
      if (!subject) {
        subject = { subject: mark.subject.name, exam_marks: {} };
        grouped[studentId].subjects.push(subject);
      }
      subject.exam_marks[examName] = mark.marks;
      totalMarksByStudentExam[key] = (totalMarksByStudentExam[key] || 0) + (mark.marks ?? 0);
    });

    const doc = new (PDFDocument as any)({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    return new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      const studentList = Object.values(grouped);
      studentList.forEach((student: any, index) => {
        if (index > 0) doc.addPage();
        const studentDetails = {
          name: student.student_name,
          class: student.class,
          roll: student.roll,
          year: student.year,
        };
        this.drawProperBackground(doc);
        this.drawWatermark(doc);
        this.drawProperHeader(doc);
        this.drawProperStudentInfo(doc, studentDetails);

        const examHeaders = student.subjects.length > 0 ? Object.keys(student.subjects[0].exam_marks) : [];
        const totals: any = {};
        examHeaders.forEach(exam => {
          totals[exam] = totalMarksByStudentExam[`${student.student_id}_${exam}`] || 0;
        });
        this.drawTableGrid(doc, doc.y, ["Subject", ...examHeaders], student.subjects, examHeaders, totals);
      });
      doc.end();
    });
  }

  private static async renderStudentReportPDF(
    student: any,
    tableData: any[],
    exams?: string[],
    totalMarksByExam?: any,
  ): Promise<Buffer> {
    const doc = new (PDFDocument as any)({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    return new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      this.drawProperBackground(doc);
      this.drawWatermark(doc);
      this.drawProperHeader(doc);
      this.drawProperStudentInfo(doc, student);

      const y = doc.y + 5;
      if (exams && exams.length > 0) {
        const headers = ["Subject", ...exams];
        this.drawTableGrid(doc, y, headers, tableData, exams, totalMarksByExam);
      } else {
        const headers = ["Subject", "Full Marks", "Obtained"];
        this.drawProperTable(doc, y, headers, tableData);
      }

      doc.end();
    });
  }

  private static drawProperBackground(doc: any) {
    // Draw Main Border
    doc.rect(20, 20, 555, 802).lineWidth(2).stroke("#000000");
    doc.rect(25, 25, 545, 792).lineWidth(0.5).stroke("#666666");
  }

  private static drawProperHeader(doc: any) {
    doc.font("Times-Bold").fontSize(10).text("Government of the People's Republic of Bangladesh", 120, 40, { align: "center", width: 350 });
    
    const schoolName = "PANCHBIBI LAL BIHARI PILOT GOVT. HIGH SCHOOL";
    const maxWidth = 400;
    let fontSize = 18;
    doc.font("Times-Bold");
    while (doc.fontSize(fontSize).widthOfString(schoolName) > maxWidth && fontSize > 8) {
      fontSize--;
    }
    doc.fontSize(fontSize).text(schoolName, 100, 55, { align: "center", width: 400 });
    doc.font("Times-Italic").fontSize(11).text("Panchbibi, Joypurhat", 120, 75, { align: "center", width: 350 });
    doc.font("Times-Bold").fontSize(10).text("EIIN: 121983, School Code: 5100", 120, 90, { align: "center", width: 350 });
    
    doc.moveDown(2);
    doc.rect(210, 115, 175, 25).fill("#f3f4f6").stroke("#000000");
    doc.fillColor("#000000").font("Times-Bold").fontSize(14).text("ACADEMIC TRANSCRIPT", 210, 122, { align: "center", width: 175 });
    
    doc.moveDown(4);
  }

  private static drawWatermark(doc: any) {
    const logoPath = path.join("public", "icon.jpg");
    if (fs.existsSync(logoPath)) {
      doc.save();
      doc.opacity(0.1);
      doc.image(logoPath, 150, 300, { width: 300 });
      doc.restore();
    }
  }

  private static drawProperStudentInfo(doc: any, student: any) {
    const startY = 160;
    doc.font("Times-Bold").fontSize(11).fillColor("#000000");
    
    // Left Column
    doc.text("Student's Name", 50, startY);
    doc.font("Times-Roman").text(`: ${student.name}`, 150, startY);
    
    doc.font("Times-Bold").text("Class", 50, startY + 18);
    doc.font("Times-Roman").text(`: ${student.class}`, 150, startY + 18);
    
    doc.font("Times-Bold").text("Roll No", 50, startY + 36);
    doc.font("Times-Roman").text(`: ${student.roll}`, 150, startY + 36);

    // Right Column
    doc.font("Times-Bold").text("Academic Year", 350, startY);
    doc.font("Times-Roman").text(`: ${student.year}`, 450, startY);
    
    if (student.exam) {
      doc.font("Times-Bold").text("Examination", 350, startY + 18);
      doc.font("Times-Roman").text(`: ${student.exam}`, 450, startY + 18);
    }
  }



  private static drawProperTable(doc: any, y: number, headers: string[], data: any[]) {
    const { startX, contentWidth, rowHeight, headerFontSize, rowFontSize, fontBold, fontRegular } = PDF_STYLES;
    const colWidths = [250, 120, 125];

    // Header
    doc.rect(startX, y, contentWidth, rowHeight).fill("#f3f4f6").stroke();
    doc.fillColor("#000000").font(fontBold).fontSize(headerFontSize);
    
    let currentX = startX;
    headers.forEach((h, i) => {
      doc.text(h, currentX + 5, y + 5, { width: colWidths[i] - 10, align: i === 0 ? "left" : "center" });
      currentX += colWidths[i];
    });

    y += rowHeight;
    doc.font(fontRegular).fontSize(rowFontSize);
    

    data.forEach((row: any) => {
      if (y > 780) { doc.addPage(); this.drawProperBackground(doc); y = 50; }
      doc.rect(startX, y, contentWidth, rowHeight).stroke();
      
      const cols = [row.subject, "100", String(row.marks ?? "-")];
      
      currentX = startX;
      cols.forEach((c, i) => {
        doc.text(c, currentX + 5, y + 5, { width: colWidths[i] - 10, align: i === 0 ? "left" : "center" });
        currentX += colWidths[i];
      });
      y += rowHeight;
    });

    // No GPA summary as requested
  }


  private static drawTableGrid(doc: any, y: number, headers: string[], data: any[], exams: string[], totals: any) {
    const { startX, contentWidth, rowHeight, headerFontSize, rowFontSize, fontBold, fontRegular } = PDF_STYLES;
    const subjectWidth = 150;
    const colWidth = (contentWidth - subjectWidth) / (exams.length || 1);

    doc.rect(startX, y, contentWidth, rowHeight).fill("#f3f4f6").stroke();
    doc.fillColor("#000000").font(fontBold).fontSize(headerFontSize);
    doc.text(headers[0], startX + 5, y + 5);
    
    exams.forEach((exam, i) => {
      doc.text(exam, startX + subjectWidth + (i * colWidth), y + 5, { width: colWidth, align: "center" });
    });

    y += rowHeight;

    doc.font(fontRegular).fontSize(rowFontSize);
    data.forEach((row: any) => {
      if (y > 780) { doc.addPage(); this.drawProperBackground(doc); y = 50; }
      doc.rect(startX, y, contentWidth, rowHeight).stroke();
      doc.text(row.subject, startX + 5, y + 5, { width: subjectWidth });
      exams.forEach((exam, i) => {
        doc.text(String(row.exam_marks[exam] ?? "-"), startX + subjectWidth + (i * colWidth), y + 5, { width: colWidth, align: "center" });
      });
      y += rowHeight;
    });

    doc.rect(startX, y, contentWidth, rowHeight).fill("#f9fafb").stroke();
    doc.fillColor("#000000").font(fontBold);
    doc.text("TOTAL", startX + 5, y + 5, { width: subjectWidth, align: "right" });
    exams.forEach((exam, i) => {
      doc.text(String(totals[exam] ?? "-"), startX + subjectWidth + (i * colWidth), y + 5, { width: colWidth, align: "center" });
    });
  }
}
