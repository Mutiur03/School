import { prisma } from "@/config/prisma.js";
import { ApiError } from "@/utils/ApiError.js";

export class SubjectService {
  static async addSubjects(subjects: any[]) {
    const current_year = new Date().getFullYear();

    if (!Array.isArray(subjects) || subjects.length === 0) {
      throw new ApiError(400, "Subjects data must be an array and cannot be empty");
    }

    for (const subject of subjects) {
      subject.name = subject.name.trim();
      subject.department = subject.department?.trim();
      subject.department === "General" && (subject.department = null);
      subject.department === "general" && (subject.department = null);

      const numericFields = [
        "class",
        "full_mark",
        "pass_mark",
        "cq_mark",
        "mcq_mark",
        "practical_mark",
        "cq_pass_mark",
        "mcq_pass_mark",
        "practical_pass_mark",
        "priority",
        "parent_id",
      ];

      for (const field of numericFields) {
        if (
          subject[field] !== undefined &&
          subject[field] !== null &&
          subject[field] !== ""
        ) {
          subject[field] = parseInt(subject[field]);
          if (isNaN(subject[field])) {
            throw new ApiError(400, `${field.replace("_", " ")} must be a valid number`);
          }
        } else {
          if (field.includes("mark") || field === "class") {
            subject[field] =
              field === "class" && !subject[field] ? subject[field] : 0;
          } else if (field === "priority") {
            subject[field] = 0;
          } else {
            subject[field] = null;
          }
        }
      }

      const fullMarkSum =
        (subject.cq_mark || 0) +
        (subject.mcq_mark || 0) +
        (subject.practical_mark || 0);
      if (fullMarkSum > 0) {
        subject.full_mark = fullMarkSum;
      }

      const passMarkSum =
        (subject.cq_pass_mark || 0) +
        (subject.mcq_pass_mark || 0) +
        (subject.practical_pass_mark || 0);
      if (passMarkSum > 0) {
        subject.pass_mark = passMarkSum;
      }

      if (!subject.class) {
        throw new ApiError(400, "Class is required");
      }

      // Default values for new fields if not provided
      subject.subject_type =
        subject.subject_type || (subject.subject_group ? "paper" : "single");
      subject.assessment_type = subject.assessment_type || "exam";
    }

    // Internal duplicate check within the provided array
    const subjectMap = new Set();
    const internalDuplicates = [];

    for (const subject of subjects) {
      const key = `${subject.name}-${subject.class}-${subject.department || "General"}-${subject.year}`;
      if (subjectMap.has(key)) {
        internalDuplicates.push(
          `${subject.name} (Class ${subject.class}, ${subject.year})`,
        );
      }
      subjectMap.add(key);
    }

    if (internalDuplicates.length > 0) {
      throw new ApiError(400, `Duplicate entries found in your file: ${internalDuplicates.join(", ")}`);
    }

    const existingSubjects = [];
    for (let subject of subjects) {
      const result = await prisma.subjects.findFirst({
        where: {
          name: subject.name,
          class: subject.class,
          department: subject.department || null,
          year: subject.year || current_year,
        },
      });

      if (result) {
        existingSubjects.push(
          `${subject.name} (Class ${subject.class}, ${subject.year || current_year})`,
        );
      }
    }

    if (existingSubjects.length > 0) {
      throw new ApiError(400, `The following subjects already exist: ${existingSubjects.join(", ")}`);
    }

    // Wrap in transaction for industry standard atomicity
    await prisma.$transaction(async (tx) => {
      // Handle Auto-Grouping Logic
      for (let subject of subjects) {
        if (subject.subject_group && !subject.parent_id) {
          // Find or create the main subject
          let mainSubject = await tx.subjects.findFirst({
            where: {
              name: subject.subject_group,
              class: subject.class,
              year: current_year,
              subject_type: "main",
              department: subject.department || null,
            },
          });

          if (!mainSubject) {
            mainSubject = await tx.subjects.create({
              data: {
                name: subject.subject_group,
                class: subject.class,
                year: current_year,
                subject_type: "main",
                department: subject.department || null,
                priority: subject.priority || 0,
              },
            });
          }
          subject.parent_id = mainSubject.id;
          subject.subject_type = "paper";
        }
      }

      const subjectData = subjects.map((subject) => ({
        name: subject.name || null,
        class: subject.class || null,
        full_mark: subject.full_mark || 0,
        pass_mark: subject.pass_mark || 0,
        cq_mark: subject.cq_mark || 0,
        mcq_mark: subject.mcq_mark || 0,
        practical_mark: subject.practical_mark || 0,
        cq_pass_mark: subject.cq_pass_mark || 0,
        mcq_pass_mark: subject.mcq_pass_mark || 0,
        practical_pass_mark: subject.practical_pass_mark || 0,
        year: subject.year || current_year,
        department: subject.department || null,
        subject_type: subject.subject_type,
        parent_id: subject.parent_id,
        assessment_type: subject.assessment_type,
        priority: subject.priority,
      }));

      await tx.subjects.createMany({
        data: subjectData,
      });

      // Sync parent marks for all parents involved
      const parentIds = [
        ...new Set(
          subjectData.filter((s) => s.parent_id).map((s) => s.parent_id),
        ),
      ];
      for (const parentId of parentIds) {
        await SubjectService.syncParentMarks(parentId, tx);
      }
    });
  }

  static async getSubjects() {
    return await prisma.subjects.findMany({
      orderBy: [{ priority: "desc" }, { id: "asc" }],
    });
  }

  static async deleteSubject(id: number) {
    const subject = await prisma.subjects.findUnique({
      where: { id },
    });

    if (!subject) {
      throw new ApiError(404, "Subject not found");
    }

    await prisma.$transaction(async (tx) => {
      await tx.subjects.delete({
        where: { id },
      });

      if (subject.parent_id) {
        await SubjectService.syncParentMarks(subject.parent_id, tx);
      }
    });

    return true;
  }

  static async syncParentMarks(parentId: number, tx: any = prisma) {
    if (!parentId) return;

    const children = await tx.subjects.findMany({
      where: { parent_id: parentId },
    });

    const totalFullMark = children.reduce(
      (sum: number, c: any) => sum + (c.full_mark || 0),
      0,
    );
    const totalPassMark = children.reduce(
      (sum: number, c: any) => sum + (c.pass_mark || 0),
      0,
    );

    // For main subject priority, use the highest (min numerical value) priority from children
    const minPriority =
      children.length > 0
        ? Math.min(...children.map((c: any) => c.priority || 0))
        : 0;

    await tx.subjects.update({
      where: { id: parentId },
      data: {
        full_mark: totalFullMark,
        pass_mark: totalPassMark,
        priority: minPriority,
      },
    });
  }

  static async updateSubject(id: number, data: any, old_parent_id?: number) {
    const {
      name,
      class: className,
      full_mark,
      pass_mark,
      cq_mark,
      mcq_mark,
      practical_mark,
      cq_pass_mark,
      mcq_pass_mark,
      practical_pass_mark,
      year,
      department,
      subject_type,
      parent_id,
      assessment_type,
      priority,
    } = data;

    const parseNumeric = (value: any, isMarkField = false): number | undefined => {
      if (value === undefined || value === null || value === "") {
        return isMarkField ? 0 : undefined;
      }
      const parsed = parseInt(value);
      return isNaN(parsed) ? (isMarkField ? 0 : undefined) : parsed;
    };

    const cqMarkVal = parseNumeric(cq_mark, true);
    const mcqMarkVal = parseNumeric(mcq_mark, true);
    const practicalMarkVal = parseNumeric(practical_mark, true);
    const cqPassMarkVal = parseNumeric(cq_pass_mark, true);
    const mcqPassMarkVal = parseNumeric(mcq_pass_mark, true);
    const practicalPassMarkVal = parseNumeric(practical_pass_mark, true);

    let fullMark = parseNumeric(full_mark, true);
    let passMark = parseNumeric(pass_mark, true);

    const fullMarkSum = (cqMarkVal || 0) + (mcqMarkVal || 0) + (practicalMarkVal || 0);
    if (fullMarkSum > 0) {
      fullMark = fullMarkSum;
    }
    const passMarkSum = (cqPassMarkVal || 0) + (mcqPassMarkVal || 0) + (practicalPassMarkVal || 0);
    if (passMarkSum > 0) {
      passMark = passMarkSum;
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.subjects.update({
          where: { id },
          data: {
            name: name || null,
            class: parseNumeric(className),
            full_mark: fullMark as number,
            pass_mark: passMark as number,
            cq_mark: cqMarkVal as number,
            mcq_mark: mcqMarkVal as number,
            practical_mark: practicalMarkVal as number,
            cq_pass_mark: cqPassMarkVal as number,
            mcq_pass_mark: mcqPassMarkVal as number,
            practical_pass_mark: practicalPassMarkVal as number,
            year: year || new Date().getFullYear(),
            department: department || null,
            subject_type: subject_type || "single",
            parent_id: parseNumeric(parent_id),
            assessment_type: assessment_type || "exam",
            priority: parseNumeric(priority) || 0,
          },
        });

        // Sync marks if it's a paper or was a paper
        if (updated.parent_id) {
          await SubjectService.syncParentMarks(updated.parent_id, tx);
        }
        // Also sync old parent if it changed
        if (
          old_parent_id &&
          parseInt(old_parent_id as any) !== updated.parent_id
        ) {
          await SubjectService.syncParentMarks(parseInt(old_parent_id as any), tx);
        }

        // Sync marks for the subject itself if it's a main subject
        if (updated.subject_type === "main") {
          await SubjectService.syncParentMarks(updated.id, tx);
        }

        return updated;
      });

      return result;
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new ApiError(404, "Subject not found");
      }
      throw error;
    }
  }
}
