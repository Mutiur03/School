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
      fourth_subject_id: enrollment.fourth_subject_id,
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
      fourth_subject_id: enrollment.fourth_subject_id,
      marks: (enrollment.marks || [])
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
    // user: any,
  ) {
    const marks = await prisma.marks.findMany({
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
        subject: {
          select: {
            name: true,
            priority: true,
            assessment_type: true,
            parent_id: true,
            parent: { select: { name: true } },
          },
        },
      },
    });

    return marks.map((mark) => ({
      subject: mark.subject.parent?.name || mark.subject.name,
      marks: mark.marks,
    }));
  }

  static async getIndividualSessionMarksPreview(
    studentId: string,
    year: string,
    user: any,
  ) {
    const sId = parseInt(studentId);
    const yearInt = parseInt(year);

    const enrollment = await prisma.student_enrollments.findFirst({
      where: { student_id: sId, year: yearInt },
    });

    if (!enrollment) {
      throw new Error("Student enrollment not found for specified year");
    }

    if (
      !this.checkAccess(
        user,
        sId,
        enrollment.class,
        enrollment.section,
        yearInt,
      )
    ) {
      throw new Error("You are not authorized to view this student's marks");
    }

    const marks = await prisma.marks.findMany({
      where: {
        enrollment: { student_id: sId, year: yearInt },
      },
      include: {
        enrollment: {
          include: { student: { select: { name: true } } },
        },
        subject: true,
        exam: { select: { exam_name: true } },
      },
    });

    if (marks.length === 0) return [];

    const grouped: any[] = [];
    const subjects: Record<string, any> = {};
    const totalMarksPerExam: Record<string, number> = {};

    marks.forEach((mark: any) => {
      const subjectName = mark.subject.parent?.name || mark.subject.name;

      if (!subjects[subjectName]) {
        subjects[subjectName] = {
          student_name: mark.enrollment.student.name,
          roll: mark.enrollment.roll,
          class: mark.enrollment.class,
          section: mark.enrollment.section,
          year: mark.enrollment.year,
          subject: subjectName,
          exam_marks: {},
          exam_breakdowns: {},
          priority: mark.subject.priority,
          final_merit: enrollment.final_merit,
        };
        grouped.push(subjects[subjectName]);
      }

      const examName = mark.exam.exam_name;
      const mVal = mark.marks ?? 0;
      subjects[subjectName].exam_marks[examName] =
        (subjects[subjectName].exam_marks[examName] || 0) + mVal;

      totalMarksPerExam[examName] = (totalMarksPerExam[examName] || 0) + mVal;
    });

    // Add totals to every entry for the frontend to consume
    grouped.forEach((entry) => {
      entry.total_marks_per_exam = totalMarksPerExam;
    });

    return grouped.sort((a, b) => a.priority - b.priority);
  }

  static aggregatePaperMarks(marksList: any[]) {
    const aggregatedData: Record<number, any> = {};
    const finalData: any[] = [];

    marksList.forEach((mark) => {
      const sub = mark.subject;
      if (sub.subject_type === "paper" && sub.parent_id) {
        const pid = sub.parent_id;
        if (!aggregatedData[pid]) {
          aggregatedData[pid] = {
            subject: sub.parent?.name || "Main Subject",
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
            subject_id: pid,
          };
        }
        const g = aggregatedData[pid];
        g.marks += mark.marks || 0;
        g.cq_marks += mark.cq_marks || 0;
        g.mcq_marks += mark.mcq_marks || 0;
        g.practical_marks += mark.practical_marks || 0;
        g.full_mark += sub.full_mark || 0;
        g.cq_mark += sub.cq_mark || 0;
        g.mcq_mark += sub.mcq_mark || 0;
        g.practical_mark += sub.practical_mark || 0;
        g.cq_pass_mark += sub.cq_pass_mark || 0;
        g.mcq_pass_mark += sub.mcq_pass_mark || 0;
        g.practical_pass_mark += sub.practical_pass_mark || 0;
        g.pass_mark += sub.pass_mark || 0;
        g.priority = Math.min(g.priority, sub.priority);
        
        // Push simplified mark data for the paper
        g.papers.push({
          subject: sub.name,
          marks: mark.marks,
          cq_marks: mark.cq_marks,
          mcq_marks: mark.mcq_marks,
          practical_marks: mark.practical_marks,
          highest_mark: mark.highest_mark || 0,
          subject_id: mark.subject_id,
          priority: sub.priority,
        });
      } else {
        finalData.push({
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
          highest_mark: mark.highest_mark || 0,
          subject_id: mark.subject_id,
        });
      }
    });

    Object.values(aggregatedData).forEach((g) => {
      // Sort papers within the group by priority
      g.papers.sort((a: any, b: any) => (a.priority || 0) - (b.priority || 0));
      finalData.push(g);
    });

    return finalData.sort((a, b) => {
      if (a.assessment_type === "exam" && b.assessment_type !== "exam")
        return -1;
      if (a.assessment_type !== "exam" && b.assessment_type === "exam")
        return 1;
      return (a.priority || 0) - (b.priority || 0);
    });
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
    if (result.length === 0 || !result.some(m => m.marks !== null)) {
      throw new Error("No marks found for this student");
    }

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
      fourth_subject_id: enrollment.fourth_subject_id,
    };

    const finalTableData = this.aggregatePaperMarks(result.map(m => ({
      ...m,
      highest_mark: highestMarksMap[m.subject_id] || 0
    })));

    console.log(finalTableData);
    console.log(finalTableData);
    console.log(studentDetails);
    const buffer = await this.renderStudentReportPDF(
      studentDetails,
      finalTableData,
      { teacher: teacherSignature, head: headSignature },
    );
    return { buffer, studentName };
  }

  static async generateBulkExamMarksheetsPDF(
    year: string,
    className: string,
    examName: string,
    section?: string,
    user?: any,
  ) {
    const yearInt = parseInt(year);
    const classNum = parseInt(className);

    const where: any = {
      class: classNum,
      year: yearInt,
    };

    if (user && user.role === "teacher") {
      const assignedSections = user.levels
        ?.filter(
          (l: any) => l.class_name === classNum && l.year === yearInt
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

    const [enrollments, allExamMarks, headMsg] = await Promise.all([
      prisma.student_enrollments.findMany({
        where,
        include: { student: { select: { id: true, name: true } } },
        orderBy: [{ roll: "asc" }, { student: { name: "asc" } }],
      }),
      prisma.marks.findMany({
        where: {
          enrollment: { class: classNum, year: yearInt },
          exam: { exam_name: examName },
        },
        include: {
          subject: {
            select: {
              id: true,
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
        },
        orderBy: {
          subject: {
            priority: "asc"
          }
        }
      }),
      prisma.head_msg.findUnique({
        where: { id: 1 },
        include: { teacher: true },
      }),
    ]);

    if (enrollments.length === 0) throw new Error("No students found");

    const highestMarksMap: Record<number, number> = {};
    const totalByEnrollment: Record<number, number> = {};
    const marksByEnrollment: Record<number, any[]> = {};

    allExamMarks.forEach((m) => {
      const marksVal = Number(m.marks || 0);
      if (!highestMarksMap[m.subject_id] || marksVal > highestMarksMap[m.subject_id]) {
        highestMarksMap[m.subject_id] = marksVal;
      }
      if (m.subject.assessment_type === "exam") {
        totalByEnrollment[m.enrollment_id] = (totalByEnrollment[m.enrollment_id] || 0) + marksVal;
      }
      if (!marksByEnrollment[m.enrollment_id]) marksByEnrollment[m.enrollment_id] = [];
      marksByEnrollment[m.enrollment_id].push(m);
    });

    const classHighestTotal = Object.values(totalByEnrollment).length > 0 ? Math.max(...Object.values(totalByEnrollment)) : 0;
    const headSignature = headMsg?.teacher?.signature ? await getFileBuffer(headMsg.teacher.signature) : null;
    const teacherSigs: Record<string, Buffer | null> = {};

    const doc = new (PDFDocument as any)({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    const studentsWithMarks = enrollments.filter(e => {
      const marks = marksByEnrollment[e.id] || [];
      return marks.some(m => m.marks !== null);
    });
    if (studentsWithMarks.length === 0) throw new Error("No non-null marks found for any student in this class.");

    return new Promise<Buffer>(async (resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      for (let i = 0; i < studentsWithMarks.length; i++) {
        const enrollment = studentsWithMarks[i];
        if (i > 0) doc.addPage();

        const studentMarks = marksByEnrollment[enrollment.id];
        const studentDetails = {
          name: enrollment.student.name,
          class: enrollment.class,
          section: enrollment.section,
          roll: enrollment.roll,
          year: yearInt,
          exam: examName,
          classHighestTotal,
          fourth_subject_id: enrollment.fourth_subject_id,
        };

        const finalTableData = this.aggregatePaperMarks(studentMarks.map(m => ({
          ...m,
          highest_mark: highestMarksMap[m.subject_id] || 0
        })));

        const sigKey = `${enrollment.class}_${enrollment.section}_${yearInt}`;
        if (!(sigKey in teacherSigs)) {
          const lv = await prisma.levels.findFirst({ where: { class_name: enrollment.class, section: enrollment.section, year: yearInt }, include: { teacher: true } });
          teacherSigs[sigKey] = lv?.teacher?.signature ? await getFileBuffer(lv.teacher.signature) : null;
        }

        await this.renderStudentMarksheetPage(doc, studentDetails, finalTableData, { teacher: teacherSigs[sigKey], head: headSignature });
      }
      doc.end();
    });
  }

  static async generateAllMarksheetsPDF(
    year: string,
    studentId?: string,
    className?: string,
    examName?: string,
  ) {
    const yearInt = parseInt(year);
    const marks = await prisma.marks.findMany({
      where: {
        enrollment: {
          year: yearInt,
          ...(studentId ? { student_id: parseInt(studentId) } : {}),
          ...(className ? { class: parseInt(className) } : {}),
        },
        ...(examName ? { exam: { exam_name: examName } } : {}),
      },
      include: {
        enrollment: {
          include: { student: { select: { id: true, name: true } } },
        },
        subject: {
          select: {
            id: true,
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
        exam: { select: { id: true, exam_name: true } },
      },
      orderBy: {
        subject: {
          priority: "asc"
        }
      }
    });

    if (marks.length === 0) throw new Error("No marks found");

    const classesAffected = Array.from(new Set(marks.map((m) => m.enrollment.class)));
    const allMarksForHighest = await prisma.marks.findMany({
      where: {
        enrollment: {
          class: { in: classesAffected },
          year: yearInt,
        },
        ...(examName ? { exam: { exam_name: examName } } : {}),
      },
      select: {
        marks: true,
        subject_id: true,
        enrollment_id: true,
        exam: { select: { exam_name: true } },
        subject: { select: { assessment_type: true } },
      },
    });

    const highestMarksMap: Record<string, Record<number, number>> = {};
    const totalsByEnrollmentExam: Record<string, number> = {};
    allMarksForHighest.forEach((m) => {
      const en = m.exam.exam_name;
      const mVal = Number(m.marks || 0);
      if (!highestMarksMap[en]) highestMarksMap[en] = {};
      if (
        !highestMarksMap[en][m.subject_id] ||
        mVal > highestMarksMap[en][m.subject_id]
      ) {
        highestMarksMap[en][m.subject_id] = mVal;
      }
      if (m.subject.assessment_type === "exam") {
        const key = `${m.enrollment_id}_${en}`;
        totalsByEnrollmentExam[key] = (totalsByEnrollmentExam[key] || 0) + mVal;
      }
    });

    const classHighestTotalByExam: Record<string, number> = {};
    Object.entries(totalsByEnrollmentExam).forEach(([key, total]) => {
      const exam = key.split("_")[1];
      if (
        !classHighestTotalByExam[exam] ||
        total > classHighestTotalByExam[exam]
      ) {
        classHighestTotalByExam[exam] = total;
      }
    });

    const studentGrouped: Record<number, Record<string, any[]>> = {};
    const studentInfoMap: Record<number, any> = {};

    marks.forEach((m) => {
      if (m.marks === null) return;
      const sid = m.enrollment.student_id;
      const en = m.exam.exam_name;
      if (!studentGrouped[sid]) studentGrouped[sid] = {};
      if (!studentGrouped[sid][en]) studentGrouped[sid][en] = [];
      studentGrouped[sid][en].push(m);

      if (!studentInfoMap[sid]) {
        studentInfoMap[sid] = {
          name: m.enrollment.student.name,
          class: m.enrollment.class,
          section: m.enrollment.section,
          roll: m.enrollment.roll,
          year: m.enrollment.year,
          fourth_subject_id: m.enrollment.fourth_subject_id,
        };
      }
    });

    const doc = new (PDFDocument as any)({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    return new Promise<Buffer>(async (resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      const [headMsg] = await Promise.all([
        prisma.head_msg.findUnique({
          where: { id: 1 },
          include: { teacher: true },
        }),
      ]);
      const headSignature = headMsg?.teacher?.signature
        ? await getFileBuffer(headMsg.teacher.signature)
        : null;
      const teacherSigs: Record<string, Buffer | null> = {};

      const studentIdsOrdered = Object.keys(studentGrouped)
        .map(Number)
        .sort((a, b) => {
          const sa = studentInfoMap[a];
          const sb = studentInfoMap[b];
          if (sa.roll !== sb.roll) return sa.roll - sb.roll;
          return sa.name.localeCompare(sb.name);
        });

      for (let i = 0; i < studentIdsOrdered.length; i++) {
        const sid = studentIdsOrdered[i];
        if (i > 0) doc.addPage();

        const info = studentInfoMap[sid];
        const exams = Object.keys(studentGrouped[sid]);

        const sigKey = `${info.class}_${info.section}_${info.year}`;
        if (!(sigKey in teacherSigs)) {
          const lv = await prisma.levels.findFirst({
            where: {
              class_name: info.class,
              section: info.section,
              year: info.year,
            },
            include: { teacher: true },
          });
          teacherSigs[sigKey] = lv?.teacher?.signature
            ? await getFileBuffer(lv.teacher.signature)
            : null;
        }
        const teacherSignature = teacherSigs[sigKey];

        // Draw page shell
        const drawPageHeader = async (examDisplayName: string) => {
          this.drawProperBackground(doc);
          await this.drawWatermark(doc);
          this.drawGradingSystemTable(doc, 440, 75);
          this.drawProperHeader(doc, { ...info, exam: examDisplayName });
          this.drawProperStudentInfo(doc, info);
        };

        await drawPageHeader("Consolidated Report");
        doc.y = 230;

        for (let j = 0; j < exams.length; j++) {
          const examName = exams[j];
          const studentMarks = studentGrouped[sid][examName];

          const finalTableData = this.aggregatePaperMarks(studentMarks.map(m => ({
            ...m,
            highest_mark: highestMarksMap[examName]?.[m.subject_id] || 0
          })));

          // Check for space before rendering this exam's table
          const estimatedHeight = 50 + finalTableData.length * 20 + 40; // title + table + summary
          if (doc.y + estimatedHeight > 750) {
            doc.addPage();
            await drawPageHeader("Consolidated Report (Contd.)");
            doc.y = 230;
          }

          const sX = PDF_STYLES.startX;
          const cW = PDF_STYLES.contentWidth;
          doc.x = sX;
          doc.moveDown(0.5);
          doc.fillColor("#000000").font("Times-Bold").fontSize(12).text(`EXAM: ${examName.toUpperCase()}`, { align: "center", width: cW, underline: true });
          doc.moveDown(0.3);

          const headers = info.class === 9 || info.class === 10
            ? ["Name of Subjects", "CQ", "MCQ", "PRAC", "Total", "Letter Grade", "Grade Point", "Highest Marks"]
            : ["Name of Subjects", "Obtained Marks", "Total", "Letter Grade", "Grade Point", "Highest Marks"];

          const { y: tableY, colWidths } = this.drawProperTable(doc, doc.y, headers, finalTableData, info.class);
          const summaryY = await this.drawSummary(
            doc,
            tableY,
            finalTableData,
            info.class,
            classHighestTotalByExam[examName] || 0,
            info.fourth_subject_id,
            info.year,
            colWidths
          );
          doc.y = summaryY;
          doc.moveDown(1);
        }

        this.drawSignatures(doc, {
          teacher: teacherSignature,
          head: headSignature,
        });
      }
      doc.end();
    });
  }



  private static async renderStudentMarksheetPage(
    doc: any,
    student: any,
    tableData: any[],
    signatures?: { teacher?: Buffer | null; head?: Buffer | null },
  ) {
    this.drawProperBackground(doc);
    await this.drawWatermark(doc);
    this.drawGradingSystemTable(doc, 440, 75);
    this.drawProperHeader(doc, student);
    this.drawProperStudentInfo(doc, student);

    const y = doc.y + 5;
    const headers =
      student.class === 9 || student.class === 10
        ? [
            "Name of Subjects",
            "CQ",
            "MCQ",
            "PRAC",
            "Total",
            "Letter Grade",
            "Grade Point",
            "Highest Marks",
          ]
        : [
            "Name of Subjects",
            "Obtained Marks",
            "Total",
            "Letter Grade",
            "Grade Point",
            "Highest Marks",
          ];

    const { y: finalY, colWidths } = this.drawProperTable(
      doc,
      y,
      headers,
      tableData,
      student.class,
    );

    await this.drawSummary(
      doc,
      finalY,
      tableData,
      student.class,
      student.classHighestTotal,
      student.fourth_subject_id,
      student.year,
      colWidths,
    );

    this.drawSignatures(doc, signatures);
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
      await this.renderStudentMarksheetPage(doc, student, tableData, signatures);
      doc.end();
    });
  }

  static async shouldApplyFourthSubjectBonus(
    className: number,
    year: number,
  ): Promise<boolean> {
    const enrollments = await prisma.student_enrollments.findMany({
      where: {
        class: className,
        year: year,
      },
      select: { fourth_subject_id: true },
    });

    if (enrollments.length === 0) return false;
    return enrollments.every((e) => e.fourth_subject_id !== null);
  }

  static calculateGPA(
    marksData: any[],
    fourthSubjectId: number | null,
    applyBonus: boolean,
    className?: number,
  ) {
    let totalMarks = 0;
    let totalGP = 0;
    let isFailed = false;
    let subjectCount = 0;

    marksData.forEach((row) => {
      if (row.marks !== null && row.assessment_type === "exam") {
        totalMarks += Number(row.marks);
        const fullMark = Number(row.full_mark || 100);
        const percentage = (Number(row.marks) / fullMark) * 100;

        const isOptional = row.subject_id === fourthSubjectId;

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
          isOptional: isOptional,
        });

        if (isOptional && applyBonus) {
          // 4th subject logic: Add points above 2.0
          if (grade.gp > 2.0) {
            totalGP += grade.gp - 2.0;
          }
          // 4th subject doesn't increase subjectCount and doesn't cause failure
        } else {
          totalGP += grade.gp;
          if (grade.lg === "F") isFailed = true;
          subjectCount++;
        }
      }
    });

    const gpaResult = isFailed
      ? 0.0
      : subjectCount > 0
        ? totalGP / subjectCount
        : 0.0;

    return {
      gpa: Math.min(gpaResult, 5.0),
      totalMarks,
      isFailed: isFailed && subjectCount > 0,
    };
  }

  private static async drawSummary(
    doc: any,
    y: number,
    tableData: any[],
    className?: number,
    classHighestTotal?: number,
    fourth_subject_id?: number | null,
    year?: number,
    colWidths?: number[],
  ) {
    const { startX, contentWidth, rowHeight } = PDF_STYLES;

    const applyBonus =
      className && year
        ? await this.shouldApplyFourthSubjectBonus(className, year)
        : false;

    const { gpa, totalMarks } = this.calculateGPA(
      tableData,
      fourth_subject_id ?? null,
      applyBonus,
      className,
    );

    const isBreakdown = className === 9 || className === 10;
    // Use passed colWidths or fall back to calculation if not provided
    let actualColWidths = colWidths;
    if (!actualColWidths) {
      const { fontBold, headerFontSize } = PDF_STYLES;
      doc.font(fontBold).fontSize(headerFontSize);
      const headers = isBreakdown 
        ? ["Name of Subjects", "CQ", "MCQ", "PRAC", "Total", "Letter Grade", "Grade Point", "Highest Marks"]
        : ["Name of Subjects", "Obtained Marks", "Total", "Letter Grade", "Grade Point", "Highest Marks"];
      const otherColWidths = headers.slice(1).map((h) => Math.max(40, doc.widthOfString(h) + 15));
      const usedWidth = otherColWidths.reduce((a, b) => a + b, 0);
      actualColWidths = [contentWidth - usedWidth, ...otherColWidths];
    }

    const totalTableWidth = actualColWidths.reduce((a, b) => a + b, 0);

    // --- Render Column-Aligned Single Summary Row ---
    const rowY = y; // Remove the gap
    doc.lineWidth(0.5).rect(startX, rowY, totalTableWidth, rowHeight).stroke("#000000");

    if (isBreakdown) {
      // Breakdown (8 cols): Subj(0), CQ(1), MCQ(2), PRAC(3), Total(4), LG(5), GP(6), High(7)
      // Merge 0-3 for Grand Total Label, Val in 4
      const w03 = actualColWidths[0] + actualColWidths[1] + actualColWidths[2] + actualColWidths[3];
      this.drawDynamicText(doc, "Grand Total Marks", startX + 5, rowY, w03 - 10, rowHeight, { align: "right", bold: true });
      doc.moveTo(startX + w03, rowY).lineTo(startX + w03, rowY + rowHeight).stroke();

      const x4 = startX + w03;
      this.drawDynamicText(doc, String(totalMarks), x4, rowY, actualColWidths[4], rowHeight, { align: "center", bold: true });
      doc.moveTo(x4 + actualColWidths[4], rowY).lineTo(x4 + actualColWidths[4], rowY + rowHeight).stroke();

      const x5 = x4 + actualColWidths[4];
      this.drawDynamicText(doc, "GPA", x5 + 5, rowY, actualColWidths[5] - 10, rowHeight, { align: "center", bold: true });
      doc.moveTo(x5 + actualColWidths[5], rowY).lineTo(x5 + actualColWidths[5], rowY + rowHeight).stroke();

      const x6 = x5 + actualColWidths[5];
      this.drawDynamicText(doc, gpa.toFixed(2), x6, rowY, actualColWidths[6], rowHeight, { align: "center", bold: true });
      doc.moveTo(x6 + actualColWidths[6], rowY).lineTo(x6 + actualColWidths[6], rowY + rowHeight).stroke();

      const x7 = x6 + actualColWidths[6];
      this.drawDynamicText(doc, `${classHighestTotal || "-"}`, x7 + 2, rowY, actualColWidths[7] - 4, rowHeight, { align: "center", bold: true });
    } else {
      // Standard (6 cols): Subj(0), Obt(1), Total(2), LG(3), GP(4), High(5)
      // Merge 0-1 for Grand Total Label, Val in 2
      const w01 = actualColWidths[0] + actualColWidths[1];
      this.drawDynamicText(doc, "Grand Total Marks", startX + 5, rowY, w01 - 10, rowHeight, { align: "right", bold: true });
      doc.moveTo(startX + w01, rowY).lineTo(startX + w01, rowY + rowHeight).stroke();

      const x2 = startX + w01;
      this.drawDynamicText(doc, String(totalMarks), x2, rowY, actualColWidths[2], rowHeight, { align: "center", bold: true });
      doc.moveTo(x2 + actualColWidths[2], rowY).lineTo(x2 + actualColWidths[2], rowY + rowHeight).stroke();

      const x3 = x2 + actualColWidths[2]; // Column 3 (LG)
      this.drawDynamicText(doc, "GPA", x3, rowY, actualColWidths[3], rowHeight, { align: "center", bold: true });
      doc.moveTo(x3 + actualColWidths[3], rowY).lineTo(x3 + actualColWidths[3], rowY + rowHeight).stroke();

      const x4 = x3 + actualColWidths[3]; // Column 4 (GP)
      this.drawDynamicText(doc, gpa.toFixed(2), x4, rowY, actualColWidths[4], rowHeight, { align: "center", bold: true });
      doc.moveTo(x4 + actualColWidths[4], rowY).lineTo(x4 + actualColWidths[4], rowY + rowHeight).stroke();

      const x5 = x4 + actualColWidths[4]; // Column 5 (Highest)
      this.drawDynamicText(doc, `${classHighestTotal || "-"}`, x5, rowY, actualColWidths[5], rowHeight, { align: "center", bold: true });
    }

    const yFinal = rowY + rowHeight + 20;
    return yFinal;
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
      .text("Panchbibi, Joypurhat.", 50, 75, { align: "center", width: 495 });
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
        doc.image(grayscaleBuffer, 150, 290, { width: 300 });
        doc.restore();
      } catch (e) {
        doc.save();
        doc.opacity(0.1);
        doc.image(logoPath, 150, 290, { width: 300 });
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
    const lineHeight = 18;
    doc.fillColor("#000000");

    // Row 1: Student's Name
    this.drawDynamicText(doc, "Student's Name:", 50, startY, 100, lineHeight, { fontSize: 11, bold: true });
    this.drawDynamicText(doc, student.name, 150, startY, 350, lineHeight, { fontSize: 11, font: "Times-Roman" });

    // Row 2: Class, Section, Roll No
    const row2Y = startY + lineHeight;
    
    // Class
    this.drawDynamicText(doc, "Class:", 50, row2Y, 50, lineHeight, { fontSize: 11, bold: true });
    this.drawDynamicText(doc, this.getClassText(student.class), 100, row2Y, 90, lineHeight, { fontSize: 11, font: "Times-Roman" });

    // Section
    this.drawDynamicText(doc, "Section:", 230, row2Y, 60, lineHeight, { fontSize: 11, bold: true });
    this.drawDynamicText(doc, student.section || "-", 290, row2Y, 50, lineHeight, { fontSize: 11, font: "Times-Roman" });

    // Roll No
    this.drawDynamicText(doc, "Roll No:", 350, row2Y, 60, lineHeight, { fontSize: 11, bold: true });
    this.drawDynamicText(doc, String(student.roll || "-"), 410, row2Y, 50, lineHeight, { fontSize: 11, font: "Times-Roman" });
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
      isOptional?: boolean;
    },
  ) {
    const passThreshold =
      breakdown?.total_pass !== undefined ? Number(breakdown.total_pass) : 33;

    if (
      breakdown &&
      (breakdown.className === 9 || breakdown.className === 10) &&
      !breakdown.isOptional
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

    doc.font(fontBold).fontSize(headerFontSize);
    const otherColWidths = headers.slice(1).map((h) => Math.max(40, doc.widthOfString(h) + 15));
    const usedWidth = otherColWidths.reduce((a, b) => a + b, 0);
    const subjectWidth = Math.max(100, contentWidth - usedWidth);
    const colWidths = [subjectWidth, ...otherColWidths];

    doc
      .fillAndStroke("#f3f4f6", "#000000")
      .lineWidth(0.5)
      .rect(startX, y, contentWidth, rowHeight)
      .fillAndStroke();
    doc.fillColor("#000000").font(fontBold).fontSize(headerFontSize);


    let currentX = startX;
    headers.forEach((h, i) => {
      this.drawDynamicText(doc, h, currentX + 5, y, colWidths[i] - 10, rowHeight, {
        fontSize: headerFontSize,
        align: i === 0 ? "left" : "center",
        bold: true,
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

          this.drawDynamicText(doc, paper.subject, startX + 5, py, colWidths[0] - 10, rowHeight, {
            fontSize: rowFontSize,
          });
          if (isBreakdown) {
            this.drawDynamicText(doc, paper.cq_marks ?? "-", startX + colWidths[0] + 5, py, colWidths[1] - 10, rowHeight, {
              fontSize: rowFontSize,
              align: "center",
            });
            this.drawDynamicText(doc, paper.mcq_marks ?? "-", startX + colWidths[0] + colWidths[1] + 5, py, colWidths[2] - 10, rowHeight, {
              fontSize: rowFontSize,
              align: "center",
            });
            this.drawDynamicText(doc, paper.practical_marks ?? "-", startX + colWidths[0] + colWidths[1] + colWidths[2] + 5, py, colWidths[3] - 10, rowHeight, {
              fontSize: rowFontSize,
              align: "center",
            });
            // Render Highest Mark for paper in breakdown
            this.drawDynamicText(doc, paper.highest_mark ? String(paper.highest_mark) : "-", startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6] + 5, py, colWidths[7] - 10, rowHeight, {
              fontSize: rowFontSize,
              align: "center",
            });
          } else {
            this.drawDynamicText(doc, paper.marks ?? "-", startX + colWidths[0] + 5, py, colWidths[1] - 10, rowHeight, {
              fontSize: rowFontSize,
              align: "center",
            });

            // DO NOT draw full_mark in Column 2 for junior groups to avoid overlap with spanned obtained total
            // (Full marks are already included in parenthesized subject name)

            // Render Highest Mark for paper in standard (Column 5)
            this.drawDynamicText(doc, paper.highest_mark ? String(paper.highest_mark) : "-", startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + 5, py, colWidths[5] - 10, rowHeight, {
              fontSize: rowFontSize,
              align: "center",
            });
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

        doc.font(fontBold).fillColor("#000000");
        this.drawDynamicText(doc, row.marks ?? "-", mx + 5, y, colWidths[middleStart] - 10, totalHeight, {
          fontSize: rowFontSize,
          align: "center",
          bold: true
        });
        this.drawDynamicText(doc, grade.lg, mx + colWidths[middleStart] + 5, y, colWidths[middleStart + 1] - 10, totalHeight, {
          fontSize: rowFontSize,
          align: "center",
          bold: true
        });
        this.drawDynamicText(doc, grade.gp.toFixed(2), mx + colWidths[middleStart] + colWidths[middleStart + 1] + 5, y, colWidths[middleStart + 2] - 10, totalHeight, {
          fontSize: rowFontSize,
          align: "center",
          bold: true
        });
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
            row.subject + (row.full_mark ? ` (${row.full_mark})` : ""),
            String(row.marks ?? "-"),
            String(row.marks ?? "-"),
            grade.lg,
            grade.gp.toFixed(2),
            row.highest_mark ? String(row.highest_mark) : "-",
          ];
        }

        currentX = startX;
        cols.forEach((c, i) => {
          this.drawDynamicText(doc, c, currentX + 5, y, colWidths[i] - 10, rowHeight, {
            fontSize: rowFontSize,
            align: i === 0 ? "left" : "center",
            bold: i === 0,
          });
          currentX += colWidths[i];
        });
        y += rowHeight;
      }
    });

    return { y, colWidths };
  }
  private static drawDynamicText(
    doc: any,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    maxHeight: number,
    options: { fontSize?: number; align?: string; font?: string; bold?: boolean } = {},
  ) {
    const fontSize = options.fontSize || 10;
    const align = options.align || "left";
    const font = options.bold ? "Times-Bold" : (options.font || "Times-Roman");
    doc.font(font).fontSize(fontSize);

    const stringText = String(text ?? "-");
    const actualWidth = doc.widthOfString(stringText);
    const textHeight = doc.currentLineHeight();
    const verticalOffset = Math.max(0, (maxHeight - textHeight) / 2);

    if (actualWidth > maxWidth - 1) {
      const scaleX = (maxWidth - 1) / actualWidth;
      doc.save();
      doc.scale(scaleX, 1);
      doc.text(stringText, x / scaleX, y + verticalOffset, {
        width: maxWidth / scaleX,
        align: align,
        lineBreak: false,
      });
      doc.restore();
    } else {
      doc.text(stringText, x, y + verticalOffset, {
        width: maxWidth + 2, // Slight extra width to prevent early wrapping
        align: align,
        lineBreak: false,
      });
    }
    return fontSize;
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

  // private static drawTableGrid(
  //   doc: any,
  //   y: number,
  //   headers: string[],
  //   data: any[],
  //   exams: string[],
  //   totals: any,
  //   gpas: any,
  // ) {
  //   const {
  //     startX,
  //     contentWidth,
  //     rowHeight,
  //     headerFontSize,
  //     rowFontSize,
  //     fontBold,
  //     fontRegular,
  //   } = PDF_STYLES;
  //   const subjectWidth = 150;
  //   const colWidth = (contentWidth - subjectWidth) / (exams.length || 1);

  //   doc
  //     .fillColor("#000000")
  //     .font(fontBold)
  //     .fontSize(headerFontSize)
  //     .lineWidth(0.5);

  //   doc
  //     .rect(startX, y, contentWidth, rowHeight)
  //     .fillAndStroke("#f3f4f6", "#000000");
    
  //   this.drawDynamicText(doc, headers[0], startX + 5, y, subjectWidth - 10, rowHeight, {
  //     fontSize: headerFontSize,
  //     bold: true,
  //   });

  //   doc
  //     .moveTo(startX + subjectWidth, y)
  //     .lineTo(startX + subjectWidth, y + rowHeight)
  //     .stroke();

  //   exams.forEach((exam, i) => {
  //     const curX = startX + subjectWidth + i * colWidth;
  //     if (i < exams.length - 1) {
  //       doc
  //         .moveTo(curX + colWidth, y)
  //         .lineTo(curX + colWidth, y + rowHeight)
  //         .stroke();
  //     }
  //     this.drawDynamicText(doc, exam, curX, y, colWidth, rowHeight, {
  //       fontSize: headerFontSize,
  //       align: "center",
  //       bold: true,
  //     });
  //   });

  //   y += rowHeight;

  //   doc.font(fontRegular).fontSize(rowFontSize);
  //   data.forEach((row: any) => {
  //     if (y > 780) {
  //       doc.addPage();
  //       this.drawProperBackground(doc);
  //       y = 50;
  //     }

  //     doc.lineWidth(0.5).rect(startX, y, contentWidth, rowHeight).stroke();
  //     this.drawDynamicText(doc, row.subject, startX + 5, y, subjectWidth - 10, rowHeight, {
  //       fontSize: rowFontSize,
  //     });

  //     doc
  //       .moveTo(startX + subjectWidth, y)
  //       .lineTo(startX + subjectWidth, y + rowHeight)
  //       .stroke();
      
  //     exams.forEach((exam, i) => {
  //       const curX = startX + subjectWidth + i * colWidth;
  //       if (i < exams.length - 1) {
  //         doc
  //           .moveTo(curX + colWidth, y)
  //           .lineTo(curX + colWidth, y + rowHeight)
  //           .stroke();
  //       }
  //       this.drawDynamicText(doc, String(row.exam_marks[exam] ?? "-"), curX, y, colWidth, rowHeight, {
  //         fontSize: rowFontSize,
  //         align: "center",
  //       });
  //     });
  //     y += rowHeight;
  //   });

  //   doc
  //     .lineWidth(0.5)
  //     .rect(startX, y, contentWidth, rowHeight)
  //     .fillAndStroke("#f9fafb", "#000000");
  //   doc.fillColor("#000000").font(fontBold);
  //   this.drawDynamicText(doc, "TOTAL", startX + 5, y, subjectWidth - 10, rowHeight, {
  //     fontSize: rowFontSize,
  //     align: "right",
  //     bold: true,
  //   });

  //   doc
  //     .moveTo(startX + subjectWidth, y)
  //     .lineTo(startX + subjectWidth, y + rowHeight)
  //     .stroke();
    
  //   exams.forEach((exam, i) => {
  //     const curX = startX + subjectWidth + i * colWidth;
  //     if (i < exams.length - 1) {
  //       doc
  //         .moveTo(curX + colWidth, y)
  //         .lineTo(curX + colWidth, y + rowHeight)
  //         .stroke();
  //     }
  //     this.drawDynamicText(doc, String(totals[exam] ?? "-"), curX, y, colWidth, rowHeight, {
  //       fontSize: rowFontSize,
  //       align: "center",
  //       bold: true,
  //     });
  //   });
  //   y += rowHeight;

  //   // Add GPA row
  //   doc
  //     .lineWidth(0.5)
  //     .rect(startX, y, contentWidth, rowHeight)
  //     .fillAndStroke("#f1f5f9", "#000000");
  //   doc.fillColor("#000000").font(fontBold);
  //   this.drawDynamicText(doc, "GPA", startX + 5, y, subjectWidth - 10, rowHeight, {
  //     fontSize: rowFontSize,
  //     align: "right",
  //     bold: true,
  //   });

  //   doc
  //     .moveTo(startX + subjectWidth, y)
  //     .lineTo(startX + subjectWidth, y + rowHeight)
  //     .stroke();
    
  //   exams.forEach((exam, i) => {
  //     const curX = startX + subjectWidth + i * colWidth;
  //     if (i < exams.length - 1) {
  //       doc
  //         .moveTo(curX + colWidth, y)
  //         .lineTo(curX + colWidth, y + rowHeight)
  //         .stroke();
  //     }
  //     this.drawDynamicText(doc, String(gpas[exam] ?? "-"), curX, y, colWidth, rowHeight, {
  //       fontSize: rowFontSize,
  //       align: "center",
  //       bold: true,
  //     });
  //   });
  // }

  static async updateFourthSubject(

    studentId: string,
    year: string,
    subjectId: number | null,
    user: any,
  ) {
    const sId = parseInt(studentId);
    const yInt = parseInt(year);

    const enrollment = await prisma.student_enrollments.findFirst({
      where: { student_id: sId, year: yInt },
    });

    if (!enrollment) {
      throw new Error("Student enrollment not found for specified year");
    }

    if (
      !this.checkAccess(user, sId, enrollment.class, enrollment.section, yInt)
    ) {
      throw new Error(
        "You are not authorized to update this student's 4th subject",
      );
    }

    return await prisma.student_enrollments.update({
      where: { id: enrollment.id },
      data: { fourth_subject_id: subjectId },
    });
  }
}
