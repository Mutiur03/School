import { prisma } from "@/config/prisma.js";
import { getFileBuffer } from "@/config/r2.js";
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import sharp from "sharp";

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
        mark.cq_marks =
          mark.cq_marks === null || mark.cq_marks === undefined
            ? null
            : Math.max(0, parseInt(mark.cq_marks));
        mark.mcq_marks =
          mark.mcq_marks === null || mark.mcq_marks === undefined
            ? null
            : Math.max(0, parseInt(mark.mcq_marks));
        mark.practical_marks =
          mark.practical_marks === null || mark.practical_marks === undefined
            ? null
            : Math.max(0, parseInt(mark.practical_marks));
        mark.marks =
          mark.marks === null || mark.marks === undefined
            ? null
            : Math.max(0, parseInt(mark.marks));
      });
    });
  }

  private static checkAccess(
    user: any,
    studentId: number,
    className: number,
    section: string,
    year: number,
  ) {
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

            let totalMarks: number | null =
              (subject as any).marking_scheme === "BREAKDOWN"
                ? (Number(cq_marks) || 0) +
                  (Number(mcq_marks) || 0) +
                  (Number(practical_marks) || 0)
                : providedTotal;

            if (
              (subject as any).marking_scheme === "BREAKDOWN" &&
              cq_marks === null &&
              mcq_marks === null &&
              practical_marks === null
            ) {
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

    if (
      !this.checkAccess(
        user,
        studentId,
        enrollment.class,
        enrollment.section,
        yearInt,
      )
    ) {
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
        enrollment: {
          include: { student: { select: { name: true } } },
        },
        subject: {
          select: {
            name: true,
            priority: true,
            assessment_type: true,
            full_mark: true,
            pass_mark: true,
            cq_mark: true,
            mcq_mark: true,
            practical_mark: true,
            cq_pass_mark: true,
            mcq_pass_mark: true,
            practical_pass_mark: true,
            subject_type: true,
            parent_id: true,
            parent: { select: { name: true } },
          },
        },
        exam: { select: { exam_name: true } },
      },
    });
    if (result.length === 0) throw new Error("No marks found for the student");

    result.sort((a, b) => {
      if (
        a.subject.assessment_type === "exam" &&
        b.subject.assessment_type !== "exam"
      )
        return -1;
      if (
        a.subject.assessment_type !== "exam" &&
        b.subject.assessment_type === "exam"
      )
        return 1;
      return (a.subject.priority || 0) - (b.subject.priority || 0);
    });
    const enrollment = result[0].enrollment;
    if (
      !this.checkAccess(
        user,
        parseInt(id),
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
    const studentSection = result[0].enrollment.section;

    // Fetch class highest marks and signatures
    const [allMarks, level, headMsg] = await Promise.all([
      prisma.marks.findMany({
        where: {
          enrollment: { class: studentClass, year: parseInt(year) },
          exam: { exam_name: exam },
        },
        select: {
          marks: true,
          subject_id: true,
          subject: { select: { assessment_type: true } },
          enrollment: { select: { student_id: true } },
        },
      }),
      prisma.levels.findFirst({
        where: {
          class_name: studentClass,
          section: studentSection,
          year: parseInt(year),
        },
        include: { teacher: true },
      }),
      prisma.head_msg.findUnique({
        where: { id: 1 },
        include: { teacher: true },
      }),
    ]);

    const teacherSignature = level?.teacher?.signature
      ? await getFileBuffer(level.teacher.signature)
      : null;
    const headSignature = headMsg?.teacher?.signature
      ? await getFileBuffer(headMsg.teacher.signature)
      : null;

    const highestMarksMap: Record<string, number> = {};
    const totalByStudent: Record<number, number> = {};

    allMarks.forEach((m: any) => {
      // Always track highest per subject
      const marksVal = Number(m.marks || 0);
      if (
        !highestMarksMap[m.subject_id] ||
        marksVal > highestMarksMap[m.subject_id]
      ) {
        highestMarksMap[m.subject_id] = marksVal;
      }

      // Track total for class highest total (skip continuous)
      if (m.subject.assessment_type === "continuous") return;

      const sId = m.enrollment.student_id;
      totalByStudent[sId] = (totalByStudent[sId] || 0) + marksVal;
    });

    const classHighestTotal =
      Object.values(totalByStudent).length > 0
        ? Math.max(...Object.values(totalByStudent))
        : 0;

    const studentDetails = {
      name: studentName,
      class: studentClass,
      section: studentSection,
      roll: studentRoll,
      year: parseInt(year),
      exam: exam,
      classHighestTotal: classHighestTotal,
    };

    const aggregatedData: Record<string, any> = {};
    const finalTableData: any[] = [];

    result.forEach((mark) => {
      const sub = mark.subject;
      const markData = {
        subject: sub.name,
        marks: mark.marks,
        cq_marks: mark.cq_marks,
        mcq_marks: mark.mcq_marks,
        practical_marks: mark.practical_marks,
        full_mark: sub.full_mark,
        cq_mark: sub.cq_mark,
        mcq_mark: sub.mcq_mark,
        practical_mark: sub.practical_mark,
        cq_pass_mark: sub.cq_pass_mark,
        mcq_pass_mark: sub.mcq_pass_mark,
        practical_pass_mark: sub.practical_pass_mark,
        pass_mark: sub.pass_mark,
        priority: sub.priority,
        assessment_type: sub.assessment_type,
        isGroup: false,
        highest_mark: highestMarksMap[mark.subject_id] || 0,
      };

      if (sub.subject_type === "paper" && sub.parent_id) {
        const parentId = sub.parent_id;
        const parentName = sub.parent?.name || "Main Subject";
        if (!aggregatedData[parentId]) {
          aggregatedData[parentId] = {
            subject: parentName,
            marks: 0,
            cq_marks: 0,
            mcq_marks: 0,
            practical_marks: 0,
            full_mark: 0,
            cq_mark: 0,
            mcq_mark: 0,
            practical_mark: 0,
            cq_pass_mark: 0,
            mcq_pass_mark: 0,
            practical_pass_mark: 0,
            pass_mark: 0,
            priority: sub.priority,
            assessment_type: sub.assessment_type,
            papers: [],
            isGroup: true,
          };
        }
        aggregatedData[parentId].marks += mark.marks || 0;
        aggregatedData[parentId].cq_marks += mark.cq_marks || 0;
        aggregatedData[parentId].mcq_marks += mark.mcq_marks || 0;
        aggregatedData[parentId].practical_marks += mark.practical_marks || 0;
        aggregatedData[parentId].full_mark += sub.full_mark || 0;
        aggregatedData[parentId].cq_mark += sub.cq_mark || 0;
        aggregatedData[parentId].mcq_mark += sub.mcq_mark || 0;
        aggregatedData[parentId].practical_mark += sub.practical_mark || 0;
        aggregatedData[parentId].cq_pass_mark += sub.cq_pass_mark || 0;
        aggregatedData[parentId].mcq_pass_mark += sub.mcq_pass_mark || 0;
        aggregatedData[parentId].practical_pass_mark +=
          sub.practical_pass_mark || 0;
        aggregatedData[parentId].pass_mark += sub.pass_mark || 0;
        aggregatedData[parentId].priority = Math.min(
          aggregatedData[parentId].priority,
          sub.priority,
        );
        aggregatedData[parentId].papers.push(markData);
      } else {
        finalTableData.push(markData);
      }
    });

    Object.values(aggregatedData).forEach((group) => {
      finalTableData.push(group);
    });

    finalTableData.sort((a, b) => {
      if (a.assessment_type === "exam" && b.assessment_type !== "exam")
        return -1;
      if (a.assessment_type !== "exam" && b.assessment_type === "exam")
        return 1;
      return (a.priority || 0) - (b.priority || 0);
    });
    console.log(finalTableData);
    console.log(studentDetails);
    const buffer = await this.renderStudentReportPDF(
      studentDetails,
      finalTableData,
      { teacher: teacherSignature, head: headSignature },
    );
    return { buffer, studentName };
  }

  static async generateAllMarksheetsPDF(year: string) {
    const marks = await prisma.marks.findMany({
      where: { enrollment: { year: parseInt(year) } },
      include: {
        enrollment: {
          include: { student: { select: { id: true, name: true } } },
        },
        subject: {
          select: {
            name: true,
            priority: true,
            assessment_type: true,
            full_mark: true,
            subject_type: true,
            parent_id: true,
            parent: { select: { name: true } },
          },
        },
        exam: { select: { exam_name: true } },
      },
      orderBy: [
        { enrollment: { student: { name: "asc" } } },
        { subject: { assessment_type: "desc" } },
        { subject: { priority: "asc" } },
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

      const sub = mark.subject;
      const subjectName =
        sub.subject_type === "paper" && sub.parent_id
          ? sub.parent?.name || "Main Subject"
          : sub.name;

      let subject = grouped[studentId].subjects.find(
        (s: any) => s.subject === subjectName,
      );
      if (!subject) {
        subject = { subject: subjectName, exam_marks: {} };
        grouped[studentId].subjects.push(subject);
      }

      subject.exam_marks[examName] =
        (subject.exam_marks[examName] || 0) + (mark.marks ?? 0);
      totalMarksByStudentExam[key] =
        (totalMarksByStudentExam[key] || 0) + (mark.marks ?? 0);
    });

    const doc = new (PDFDocument as any)({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    return new Promise<Buffer>(async (resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      const headMsg = await prisma.head_msg.findUnique({
        where: { id: 1 },
        include: { teacher: true },
      });
      const headSignature = headMsg?.teacher?.signature
        ? await getFileBuffer(headMsg.teacher.signature)
        : null;

      const teacherSignaturesCache: Record<string, Buffer | null> = {};

      const studentList = Object.values(grouped);
      for (let i = 0; i < studentList.length; i++) {
        const student: any = studentList[i];
        if (i > 0) doc.addPage();
        const studentDetails = {
          name: student.student_name,
          class: student.class,
          section: student.section,
          roll: student.roll,
          year: student.year,
          exam: "Consolidated Report",
        };

        const levelKey = `${student.class}_${student.section}_${student.year}`;
        if (!(levelKey in teacherSignaturesCache)) {
          const level = await prisma.levels.findFirst({
            where: {
              class_name: student.class,
              section: student.section,
              year: student.year,
            },
            include: { teacher: true },
          });
          teacherSignaturesCache[levelKey] = level?.teacher?.signature
            ? await getFileBuffer(level.teacher.signature)
            : null;
        }
        const teacherSignature = teacherSignaturesCache[levelKey];

        this.drawProperBackground(doc);
        await this.drawWatermark(doc);
        this.drawGradingSystemTable(doc, 440, 75);
        this.drawProperHeader(doc, studentDetails);
        this.drawProperStudentInfo(doc, studentDetails);

        const examHeaders =
          student.subjects.length > 0
            ? Object.keys(student.subjects[0].exam_marks)
            : [];
        const totals: any = {};
        examHeaders.forEach((exam) => {
          totals[exam] =
            totalMarksByStudentExam[`${student.student_id}_${exam}`] || 0;
        });
        this.drawTableGrid(
          doc,
          doc.y,
          ["Subject", ...examHeaders],
          student.subjects,
          examHeaders,
          totals,
        );

        this.drawSignatures(doc, {
          teacher: teacherSignature,
          head: headSignature,
        });
      }
      doc.end();
    });
  }

  private static async renderStudentReportPDF(
    student: any,
    tableData: any[],
    signatures?: { teacher?: Buffer | null; head?: Buffer | null },
  ): Promise<Buffer> {
    const doc = new (PDFDocument as any)({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    return new Promise<Buffer>(async (resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      this.drawProperBackground(doc);
      await this.drawWatermark(doc);
      this.drawGradingSystemTable(doc, 440, 75);
      this.drawProperHeader(doc, student);
      this.drawProperStudentInfo(doc, student);

      const y = doc.y + 5;
      const headers =
        student.class === 9 || student.class === 10
          ? [
              "Subjects",
              "CQ",
              "MCQ",
              "PRAC",
              "Total",
              "Letter Grade",
              "Grade Point",
              "Highest",
            ]
          : [
              "Subjects",
              "Obtained",
              "Total",
              "Letter Grade",
              "Grade Point",
              "Highest",
            ];

      const finalY = this.drawProperTable(
        doc,
        y,
        headers,
        tableData,
        student.class,
      );

      this.drawSummary(
        doc,
        finalY,
        tableData,
        student.class,
        student.classHighestTotal,
      );

      this.drawSignatures(doc, signatures);

      doc.end();
    });
  }

  private static drawSummary(
    doc: any,
    y: number,
    tableData: any[],
    className?: number,
    classHighestTotal?: number,
  ) {
    const { startX, contentWidth, rowHeight, fontBold } = PDF_STYLES;

    let totalMarks = 0;
    let totalGP = 0;
    let isFailed = false;
    let subjectCount = 0;

    tableData.forEach((row) => {
      if (row.marks !== null && row.assessment_type === "exam") {
        totalMarks += Number(row.marks);
        const fullMark = Number(row.full_mark || 100);
        const percentage = (Number(row.marks) / fullMark) * 100;
        const grade = this.getGradeByPercentage(percentage, {
          total: row.marks,
          total_pass: row.pass_mark,
          cq: row.cq_marks,
          cq_pass: row.cq_pass_mark,
          mcq: row.mcq_marks,
          mcq_pass: row.mcq_pass_mark,
          pr: row.practical_marks,
          pr_pass: row.practical_pass_mark,
          className: className,
        });
        totalGP += grade.gp;
        if (grade.lg === "F") isFailed = true;
        subjectCount++;
      }
    });

    const gpa = isFailed
      ? 0.0
      : subjectCount > 0
        ? totalGP / subjectCount
        : 0.0;

    const isBreakdown = className === 9 || className === 10;
    const summaryColWidths = isBreakdown
      ? [105, 40, 40, 40, 75, 70, 65, 60]
      : [125, 60, 60, 85, 80, 85];

    // const labelWidth = isBreakdown
    //   ? summaryColWidths[0] +
    //     summaryColWidths[1] +
    //     summaryColWidths[2] +
    //     summaryColWidths[3]
    //   : summaryColWidths[0] + summaryColWidths[1];

    // const totalMarksColIndex = isBreakdown ? 4 : 2;

    const row1Y = y;
    const row2Y = row1Y + rowHeight;
    const row3Y = row2Y + rowHeight;
    const totalBlockHeight = rowHeight * 3;

    // --- Draw Rectangles (Backgrounds) ---
    doc.lineWidth(0.5);
    [row1Y, row2Y, row3Y].forEach((ry) => {
      doc.rect(startX, ry, contentWidth, rowHeight).stroke("#000000");
    });

    // --- Vertical Grid Line Position (Align value with rightmost column) ---
    const lastColWidth = summaryColWidths[summaryColWidths.length - 1];
    const dataColStartX = startX + (contentWidth - lastColWidth);
    const labelBoxWidth = contentWidth - lastColWidth;

    // --- Render Content ---
    doc.fillColor("#000000").font(fontBold).fontSize(10);

    // Row 1: Student Total
    doc.text("Total", startX + 5, row1Y + 5, {
      width: labelBoxWidth - 10,
      align: "right",
    });
    doc.text(String(totalMarks), dataColStartX + 5, row1Y + 5, {
      width: lastColWidth - 10,
      align: "center",
    });

    // Row 2: Class Highest Total
    doc.text("Highest Total Marks in Class", startX + 5, row2Y + 5, {
      width: labelBoxWidth - 10,
      align: "right",
    });
    doc.text(String(classHighestTotal ?? "-"), dataColStartX + 5, row2Y + 5, {
      width: lastColWidth - 10,
      align: "center",
    });

    // Row 3: GPA
    doc.text("Grade Point Average (GPA)", startX + 5, row3Y + 5, {
      width: labelBoxWidth - 10,
      align: "right",
    });
    doc.text(gpa.toFixed(2), dataColStartX + 5, row3Y + 5, {
      width: lastColWidth - 10,
      align: "center",
    });

    // --- Final Unified Pass: Draw all vertical lines ---
    doc.lineWidth(0.5).fillColor("#000000");
    // Draw only a single vertical line to separate the wide label and the rightmost value
    doc
      .moveTo(dataColStartX, row1Y)
      .lineTo(dataColStartX, row1Y + totalBlockHeight)
      .stroke();

    y = row1Y + totalBlockHeight + 10;

    this.drawSignatures(doc);

    return y;
  }

  private static drawSignatures(
    doc: any,
    signatures?: { teacher?: Buffer | null; head?: Buffer | null },
  ) {
    doc.fontSize(10).font("Times-Bold").fillColor("#000000");
    const lineY = 780;
    const textY = 788;
    const lineWidth = 90;

    // Dotted lines for signatures
    doc.lineWidth(0.5).dash(1, { space: 1 });

    const gStartX = 65;
    const tStartX = 252.5;
    const hStartX = 440;

    // Render Teacher signature if provided
    if (signatures?.teacher) {
      try {
        doc.image(signatures.teacher, tStartX + (lineWidth - 60) / 2, lineY - 40, { width: 60 });
      } catch (err) {
        console.error("Teacher signature image error:", err);
      }
    }

    // Render Headmaster signature if provided
    if (signatures?.head) {
      try {
        doc.image(signatures.head, hStartX + (lineWidth - 60) / 2, lineY - 40, { width: 60 });
      } catch (err) {
        console.error("Head signature image error:", err);
      }
    }

    doc.moveTo(65, lineY).lineTo(65 + lineWidth, lineY).stroke();
    doc.text("Guardian", 65, textY, { width: lineWidth, align: "center" });

    doc.moveTo(252.5, lineY).lineTo(252.5 + lineWidth, lineY).stroke();
    doc.text("Class Teacher", 252.5, textY, {
      width: lineWidth,
      align: "center",
    });

    doc.moveTo(440, lineY).lineTo(440 + lineWidth, lineY).stroke();
    doc.text("Headmaster", 440, textY, { width: lineWidth, align: "center" });

    doc.undash();
  }

  private static drawProperBackground(doc: any) {
    doc.rect(20, 20, 555, 802).lineWidth(2).stroke("#000000");
    doc.rect(25, 25, 545, 792).lineWidth(0.5).stroke("#666666");
  }

  private static drawProperHeader(doc: any, exam?: any) {
    doc
      .font("Times-Bold")
      .fontSize(10)
      .text("Government of the People's Republic of Bangladesh", 50, 40, {
        align: "center",
        width: 495,
      });

    const schoolName = "PANCHBIBI LAL BIHARI PILOT GOVT. HIGH SCHOOL";
    const maxWidth = 400;
    let fontSize = 18;
    doc.font("Times-Bold");
    while (
      doc.fontSize(fontSize).widthOfString(schoolName) > maxWidth &&
      fontSize > 8
    ) {
      fontSize--;
    }
    doc
      .fontSize(fontSize)
      .text(schoolName, 50, 55, { align: "center", width: 495 });
    doc
      .font("Times-Bold")
      .fontSize(11)
      .text("Panchbibi, Joypurhat", 50, 75, { align: "center", width: 495 });
    doc
      .font("Times-Bold")
      .fontSize(10)
      .text("EIIN: 121983, School Code: 5100", 50, 90, {
        align: "center",
        width: 495,
      });

    if (exam && (exam.exam || exam.year)) {
      const examName = exam.exam || "";
      const session = exam.year ? String(exam.year) : "";
      const headerText =
        examName && session ? `${examName} - ${session}` : examName || session;

      doc
        .fillColor("#000000")
        .font("Times-Bold")
        .fontSize(16)
        .text(headerText, 50, 105, {
          align: "center",
          width: 495,
        });
    }
    doc.rect(197.5, 128, 200, 25).fill("#f3f4f6").stroke("#000000");
    doc
      .fillColor("#000000")
      .font("Times-Bold")
      .fontSize(14)
      .text("ACADEMIC TRANSCRIPT", 197.5, 135, {
        align: "center",
        width: 200,
      });
  }

  private static async drawWatermark(doc: any) {
    const logoPath = path.join("public", "icon.jpg");
    if (fs.existsSync(logoPath)) {
      try {
        const grayscaleBuffer = await sharp(logoPath).grayscale().toBuffer();
        doc.save();
        doc.opacity(0.1);
        doc.image(grayscaleBuffer, 150, 300, { width: 300 });
        doc.restore();
      } catch (e) {
        doc.save();
        doc.opacity(0.1);
        doc.image(logoPath, 150, 300, { width: 300 });
        doc.restore();
      }
    }
  }

  private static getClassText(classNum: number | string): string {
    const classMap: Record<string, string> = {
      "6": "Six",
      "7": "Seven",
      "8": "Eight",
      "9": "Nine",
      "10": "Ten",
    };
    return classMap[String(classNum)] || String(classNum);
  }

  private static drawProperStudentInfo(doc: any, student: any) {
    const startY = 185;
    doc.font("Times-Bold").fontSize(11).fillColor("#000000");

    doc.text("Student's Name:", 50, startY);
    doc.font("Times-Roman").text(`${student.name}`, 150, startY);

    doc.font("Times-Bold").text("Class:", 50, startY + 18);
    doc
      .font("Times-Roman")
      .text(`${this.getClassText(student.class)}`, 150, startY + 18);
    doc.font("Times-Bold").text("Section:", 250, startY + 18);
    doc.font("Times-Roman").text(`${student.section}`, 300, startY + 18);

    doc.font("Times-Bold").text("Roll No:", 350, startY + 18);
    doc.font("Times-Roman").text(`${student.roll}`, 400, startY + 18);
  }

  private static getGradeByPercentage(
    percentage: number,
    breakdown?: {
      total?: number;
      total_pass?: number;
      cq?: number;
      cq_pass?: number;
      mcq?: number;
      mcq_pass?: number;
      pr?: number;
      pr_pass?: number;
      className?: number;
    },
  ) {
    const passThreshold =
      breakdown?.total_pass !== undefined ? Number(breakdown.total_pass) : 33;

    if (
      breakdown &&
      (breakdown.className === 9 || breakdown.className === 10)
    ) {
      if (
        (breakdown.cq_pass && (breakdown.cq || 0) < (breakdown.cq_pass || 0)) ||
        (breakdown.mcq_pass &&
          (breakdown.mcq || 0) < (breakdown.mcq_pass || 0)) ||
        (breakdown.pr_pass && (breakdown.pr || 0) < (breakdown.pr_pass || 0)) ||
        (breakdown.total !== undefined &&
          breakdown.total_pass !== undefined &&
          breakdown.total < breakdown.total_pass)
      ) {
        return { lg: "F", gp: 0.0 };
      }
    }

    if (percentage < passThreshold) {
      return { lg: "F", gp: 0.0 };
    }

    if (percentage >= 80) return { lg: "A+", gp: 5.0 };
    if (percentage >= 70) return { lg: "A", gp: 4.0 };
    if (percentage >= 60) return { lg: "A-", gp: 3.5 };
    if (percentage >= 50) return { lg: "B", gp: 3.0 };
    if (percentage >= 40) return { lg: "C", gp: 2.0 };
    if (percentage >= 33) return { lg: "D", gp: 1.0 };
    return { lg: "F", gp: 0.0 };
  }

  private static drawProperTable(
    doc: any,
    y: number,
    headers: string[],
    data: any[],
    className?: number,
  ) {
    const {
      startX,
      contentWidth,
      rowHeight,
      headerFontSize,
      rowFontSize,
      fontBold,
      fontRegular,
    } = PDF_STYLES;
    const isBreakdown = className === 9 || className === 10;
    const colWidths = isBreakdown
      ? [105, 40, 40, 40, 75, 70, 65, 60] // Breakdown (8 cols)
      : [125, 60, 60, 85, 80, 85]; // Standard (6 cols)

    doc
      .fillAndStroke("#f3f4f6", "#000000")
      .lineWidth(0.5)
      .rect(startX, y, contentWidth, rowHeight)
      .fillAndStroke();
    doc.fillColor("#000000").font(fontBold).fontSize(headerFontSize);

    let currentX = startX;
    headers.forEach((h, i) => {
      doc.text(h, currentX + 5, y + 5, {
        width: colWidths[i] - 10,
        align: i === 0 ? "left" : "center",
      });
      if (i < headers.length - 1) {
        doc
          .moveTo(currentX + colWidths[i], y)
          .lineTo(currentX + colWidths[i], y + rowHeight)
          .stroke();
      }
      currentX += colWidths[i];
    });

    y += rowHeight;
    doc.font(fontRegular).fontSize(rowFontSize);

    let lastType = "exam";
    data.forEach((row: any) => {
      if (row.assessment_type !== lastType) {
        y += 5;
        lastType = row.assessment_type;

        doc
          .font(fontBold)
          .fontSize(headerFontSize - 1)
          .fillColor("#4b5563");
        doc.text("CONTINUOUS ASSESSMENT", startX, y, {
          align: "center",
          width: contentWidth,
        });
        doc.fillColor("#000000").font(fontRegular).fontSize(rowFontSize);
        y += rowHeight - 5;
      }

      const rowCount = row.isGroup && row.papers ? row.papers.length : 1;
      const totalHeight = rowCount * rowHeight;

      if (y + totalHeight > 750) {
        doc.addPage();
        this.drawProperBackground(doc);
        y = 50;
      }

      doc.lineWidth(0.5).rect(startX, y, contentWidth, totalHeight).stroke();

      if (row.isGroup) {
        row.papers.forEach((paper: any, pIdx: number) => {
          const py = y + pIdx * rowHeight;
          if (pIdx > 0) {
            const hLineEnd = isBreakdown
              ? startX +
                colWidths[0] +
                colWidths[1] +
                colWidths[2] +
                colWidths[3]
              : startX + colWidths[0] + colWidths[1];
            doc.moveTo(startX, py).lineTo(hLineEnd, py).stroke();

            // Also draw horizontal line for the "Highest" column
            const highestStart = isBreakdown
              ? startX +
                colWidths[0] +
                colWidths[1] +
                colWidths[2] +
                colWidths[3] +
                colWidths[4] +
                colWidths[5] +
                colWidths[6]
              : startX +
                colWidths[0] +
                colWidths[1] +
                colWidths[2] +
                colWidths[3] +
                colWidths[4];

            doc
              .moveTo(highestStart, py)
              .lineTo(startX + contentWidth, py)
              .stroke();
          }

          doc.text(paper.subject, startX + 5, py + 5, {
            width: colWidths[0] - 10,
          });
          if (isBreakdown) {
            doc.text(
              String(paper.cq_marks ?? "-"),
              startX + colWidths[0] + 5,
              py + 5,
              { width: colWidths[1] - 10, align: "center" },
            );
            doc.text(
              String(paper.mcq_marks ?? "-"),
              startX + colWidths[0] + colWidths[1] + 5,
              py + 5,
              { width: colWidths[2] - 10, align: "center" },
            );
            doc.text(
              String(paper.practical_marks ?? "-"),
              startX + colWidths[0] + colWidths[1] + colWidths[2] + 5,
              py + 5,
              { width: colWidths[3] - 10, align: "center" },
            );
            // Render Highest Mark for paper in breakdown
            doc.text(
              paper.highest_mark ? String(paper.highest_mark) : "-",

              startX +
                colWidths[0] +
                colWidths[1] +
                colWidths[2] +
                colWidths[3] +
                colWidths[4] +
                colWidths[5] +
                colWidths[6] +
                5,
              py + 5,
              { width: colWidths[7] - 10, align: "center" },
            );
          } else {
            // Standard Junior Layout: Only Obtained and Highest
            doc.text(
              String(paper.marks ?? "-"),
              startX + colWidths[0] + 5,
              py + 5,
              { width: colWidths[1] - 10, align: "center" },
            );

            // Render Highest Mark for paper in standard (Column 5)
            doc.text(
              paper.highest_mark ? String(paper.highest_mark) : "-",
              startX +
                colWidths[0] +
                colWidths[1] +
                colWidths[2] +
                colWidths[3] +
                colWidths[4] +
                5,
              py + 5,
              { width: colWidths[5] - 10, align: "center" },
            );
          }
        });

        let vx = startX;
        const middleStart = isBreakdown ? 4 : 2;
        for (let i = 0; i < middleStart; i++) {
          vx += colWidths[i];
          doc
            .moveTo(vx, y)
            .lineTo(vx, y + totalHeight)
            .stroke();
        }

        vx = startX;
        for (let i = 0; i < colWidths.length - 1; i++) {
          vx += colWidths[i];
          if (i >= middleStart - 1) {
            doc
              .moveTo(vx, y)
              .lineTo(vx, y + totalHeight)
              .stroke();
          }
        }

        const mx =
          startX + colWidths.slice(0, middleStart).reduce((a, b) => a + b, 0);
        const fullMark = Number(row.full_mark);
        const grade = this.getGradeByPercentage((row.marks / fullMark) * 100, {
          total: row.marks,
          total_pass: row.pass_mark,
          cq: row.cq_marks,
          cq_pass: row.cq_pass_mark,
          mcq: row.mcq_marks,
          mcq_pass: row.mcq_pass_mark,
          pr: row.practical_marks,
          pr_pass: row.practical_pass_mark,
        });

        const midY = y + totalHeight / 2 - 5;
        doc.font(fontBold).fillColor("#000000");
        doc.text(String(row.marks ?? "-"), mx + 5, midY, {
          width: colWidths[middleStart] - 10,
          align: "center",
        });
        doc.text(grade.lg, mx + colWidths[middleStart] + 5, midY, {
          width: colWidths[middleStart + 1] - 10,
          align: "center",
        });
        doc.text(
          grade.gp.toFixed(2),
          mx + colWidths[middleStart] + colWidths[middleStart + 1] + 5,
          midY,
          { width: colWidths[middleStart + 2] - 10, align: "center" },
        );
        doc.font(fontRegular);

        y += totalHeight;
      } else {
        let vx = startX;
        for (let i = 0; i < colWidths.length - 1; i++) {
          vx += colWidths[i];
          doc
            .moveTo(vx, y)
            .lineTo(vx, y + rowHeight)
            .stroke();
        }

        const fullMark = Number(row.full_mark || 100);
        const grade = this.getGradeByPercentage((row.marks / fullMark) * 100, {
          total: row.marks,
          total_pass: row.pass_mark,
          cq: row.cq_marks,
          cq_pass: row.cq_pass_mark,
          mcq: row.mcq_marks,
          mcq_pass: row.mcq_pass_mark,
          pr: row.practical_marks,
          pr_pass: row.practical_pass_mark,
          className: className,
        });

        let cols: string[] = [];
        if (isBreakdown) {
          cols = [
            row.subject,
            String(row.cq_marks ?? "-"),
            String(row.mcq_marks ?? "-"),
            String(row.practical_marks ?? "-"),
            String(row.marks ?? "-"),
            grade.lg,
            grade.gp.toFixed(2),
            row.highest_mark ? String(row.highest_mark) : "-",
          ];
        } else {
          cols = [
            row.subject,
            String(row.marks ?? "-"),
            String(row.marks ?? "-"),
            grade.lg,
            grade.gp.toFixed(2),
            row.highest_mark ? String(row.highest_mark) : "-",
          ];
        }

        currentX = startX;
        cols.forEach((c, i) => {
          doc.text(c, currentX + 5, y + 5, {
            width: colWidths[i] - 10,
            align: i === 0 ? "left" : "center",
          });
          currentX += colWidths[i];
        });
        y += rowHeight;
      }
    });

    return y;
  }

  private static drawGradingSystemTable(doc: any, x: number, y: number) {
    const grades = [
      { range: "80% - 100%", lg: "A+", gp: "5.00" },
      { range: "70% - 79%", lg: "A", gp: "4.00" },
      { range: "60% - 69%", lg: "A-", gp: "3.50" },
      { range: "50% - 59%", lg: "B", gp: "3.00" },
      { range: "40% - 49%", lg: "C", gp: "2.00" },
      { range: "33% - 39%", lg: "D", gp: "1.00" },
      { range: "01% - 32%", lg: "F", gp: "0.00" },
    ];

    const rowWidth = 120;
    const rowHeight = 11;
    const colWidths = [50, 35, 35];

    doc
      .lineWidth(0.5)
      .rect(x, y, rowWidth, rowHeight)
      .fillAndStroke("#d1d1d1", "#000000");
    doc
      .fillColor("#000000")
      .font("Times-Bold")
      .fontSize(7)
      .text("GRADING SYSTEM CHART", x, y + 2, {
        align: "center",
        width: rowWidth,
      });

    y += rowHeight;

    doc
      .lineWidth(0.5)
      .rect(x, y, rowWidth, rowHeight)
      .fillAndStroke("#e5e5e5", "#000000");
    doc.fillColor("#000000").font("Times-Bold").fontSize(7);

    let curX = x;
    const headers = ["Marks Range", "LG", "GP"];
    headers.forEach((h, i) => {
      doc.text(h, curX + 2, y + 2, {
        width: colWidths[i] - 4,
        align: "center",
      });
      if (i < headers.length - 1) {
        doc
          .moveTo(curX + colWidths[i], y)
          .lineTo(curX + colWidths[i], y + rowHeight)
          .stroke();
      }
      curX += colWidths[i];
    });

    y += rowHeight;
    doc.font("Times-Roman").fontSize(7);

    grades.forEach((g) => {
      doc.lineWidth(0.5).rect(x, y, rowWidth, rowHeight).stroke();
      let curX = x;
      const values = [g.range, g.lg, g.gp];
      values.forEach((v, i) => {
        doc.text(String(v), curX + 2, y + 2, {
          width: colWidths[i] - 4,
          align: "center",
        });
        if (i < values.length - 1) {
          doc
            .moveTo(curX + colWidths[i], y)
            .lineTo(curX + colWidths[i], y + rowHeight)
            .stroke();
        }
        curX += colWidths[i];
      });
      y += rowHeight;
    });
  }

  private static drawTableGrid(
    doc: any,
    y: number,
    headers: string[],
    data: any[],
    exams: string[],
    totals: any,
  ) {
    const {
      startX,
      contentWidth,
      rowHeight,
      headerFontSize,
      rowFontSize,
      fontBold,
      fontRegular,
    } = PDF_STYLES;
    const subjectWidth = 150;
    const colWidth = (contentWidth - subjectWidth) / (exams.length || 1);

    doc
      .fillColor("#000000")
      .font(fontBold)
      .fontSize(headerFontSize)
      .lineWidth(0.5);

    doc
      .rect(startX, y, contentWidth, rowHeight)
      .fillAndStroke("#f3f4f6", "#000000");
    doc.fillColor("#000000").text(headers[0], startX + 5, y + 5);

    doc
      .moveTo(startX + subjectWidth, y)
      .lineTo(startX + subjectWidth, y + rowHeight)
      .stroke();
    exams.forEach((exam, i) => {
      const curX = startX + subjectWidth + i * colWidth;
      if (i < exams.length - 1) {
        doc
          .moveTo(curX + colWidth, y)
          .lineTo(curX + colWidth, y + rowHeight)
          .stroke();
      }
      doc.text(exam, curX, y + 5, { width: colWidth, align: "center" });
    });

    y += rowHeight;

    doc.font(fontRegular).fontSize(rowFontSize);
    data.forEach((row: any) => {
      if (y > 780) {
        doc.addPage();
        this.drawProperBackground(doc);
        y = 50;
      }

      doc.lineWidth(0.5).rect(startX, y, contentWidth, rowHeight).stroke();
      doc.text(row.subject, startX + 5, y + 5, { width: subjectWidth - 10 });

      doc
        .moveTo(startX + subjectWidth, y)
        .lineTo(startX + subjectWidth, y + rowHeight)
        .stroke();
      exams.forEach((exam, i) => {
        const curX = startX + subjectWidth + i * colWidth;
        if (i < exams.length - 1) {
          doc
            .moveTo(curX + colWidth, y)
            .lineTo(curX + colWidth, y + rowHeight)
            .stroke();
        }
        doc.text(String(row.exam_marks[exam] ?? "-"), curX, y + 5, {
          width: colWidth,
          align: "center",
        });
      });
      y += rowHeight;
    });

    doc
      .lineWidth(0.5)
      .rect(startX, y, contentWidth, rowHeight)
      .fillAndStroke("#f9fafb", "#000000");
    doc.fillColor("#000000").font(fontBold);
    doc.text("TOTAL", startX + 5, y + 5, {
      width: subjectWidth - 10,
      align: "right",
    });

    doc
      .moveTo(startX + subjectWidth, y)
      .lineTo(startX + subjectWidth, y + rowHeight)
      .stroke();
    exams.forEach((exam, i) => {
      const curX = startX + subjectWidth + i * colWidth;
      if (i < exams.length - 1) {
        doc
          .moveTo(curX + colWidth, y)
          .lineTo(curX + colWidth, y + rowHeight)
          .stroke();
      }
      doc.text(String(totals[exam] ?? "-"), curX, y + 5, {
        width: colWidth,
        align: "center",
      });
    });
  }
}
