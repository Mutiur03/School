import { prisma } from "@/config/prisma.js";
import { ApiError } from "@/utils/ApiError.js";

export class SubjectService {
  static async addSubjects(subjects: any[]) {
    const current_year = new Date().getFullYear();

    if (!Array.isArray(subjects) || subjects.length === 0) {
      throw new ApiError(400, "Subjects data must be an array and cannot be empty");
    }

    for (const subject of subjects) {
      if (subject.group === "General" || subject.group === "general") {
        subject.group = null;
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
    }

    // Internal duplicate check within the provided array
    const subjectMap = new Set();
    const internalDuplicates = [];

    for (const subject of subjects) {
      const key = `${subject.name}-${subject.class}-${subject.group || "General"}-${subject.year}`;
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
          group: subject.group || null,
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
              year: subject.year || current_year,
              group: subject.group || null,
            },
          });

          if (!mainSubject) {
            mainSubject = await tx.subjects.create({
              data: {
                name: subject.subject_group,
                class: subject.class,
                year: subject.year || current_year,
                subject_type: "main",
                assessment_type: subject.assessment_type || "exam",
                group: subject.group || null,
                priority: subject.priority ?? 0,
              },
            });
            // Mark it if it was also in the batch
            subjects.forEach(s => {
              if (s.name === mainSubject!.name && s.class === mainSubject!.class && s.year === mainSubject!.year && s.subject_type === "main") {
                s._alreadyCreated = true;
              }
            });
          } else if (mainSubject.subject_type !== "main") {
            // Convert to main if it exists as something else
            mainSubject = await tx.subjects.update({
              where: { id: mainSubject.id },
              data: { subject_type: "main" }
            });
            // Mark it if it was also in the batch
            subjects.forEach(s => {
              if (s.id === mainSubject!.id) {
                s._alreadyCreated = true;
              }
            });
          }

          subject.parent_id = mainSubject.id;
          subject.subject_type = "paper";
        }
      }

      const subjectData = subjects
        .filter((s) => s.subject_type !== "main" || !s._alreadyCreated)
        .map((subject) => ({
          name: subject.name || null,
          class: subject.class, // required field
          full_mark: subject.full_mark ?? 0,
          pass_mark: subject.pass_mark ?? 0,
          cq_mark: subject.cq_mark ?? 0,
          mcq_mark: subject.mcq_mark ?? 0,
          practical_mark: subject.practical_mark ?? 0,
          cq_pass_mark: subject.cq_pass_mark ?? 0,
          mcq_pass_mark: subject.mcq_pass_mark ?? 0,
          practical_pass_mark: subject.practical_pass_mark ?? 0,
          year: subject.year || current_year,
          group: subject.group || null,
          subject_type: subject.subject_type,
          parent_id: subject.parent_id || null,
          assessment_type: subject.assessment_type || "exam",
          marking_scheme: subject.marking_scheme || "TOTAL",
          priority: subject.priority ?? 0,
        }));

      if (subjectData.length > 0) {
        await tx.subjects.createMany({
          data: subjectData,
        });
      }

      // Sync parent marks for all parents involved
      const parentIds = [...new Set(subjectData.filter((s) => s.parent_id).map((s) => s.parent_id))];
      for (const parentId of parentIds) {
        if (parentId) await SubjectService.syncParentMarks(parentId, tx);
      }
    });
  }

  static async getSubjects() {
    return await prisma.subjects.findMany({
      orderBy: [{ priority: "asc" }, { id: "asc" }],
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
    const minPriority = children.length > 0 ? Math.min(...children.map((c: any) => c.priority || 0)) : 0;
    
    // Sync assessment_type to match children (usually siblings share same type)
    const firstChild = children[0];

    await tx.subjects.update({
      where: { id: parentId },
      data: {
        full_mark: totalFullMark,
        pass_mark: totalPassMark,
        priority: minPriority,
        assessment_type: firstChild?.assessment_type || "exam",
      },
    });
  }

  static async updateSubject(id: number, data: any, old_parent_id?: number) {
    let { full_mark, pass_mark } = data;

    const fullMarkSum = (data.cq_mark || 0) + (data.mcq_mark || 0) + (data.practical_mark || 0);
    if (fullMarkSum > 0) {
      full_mark = fullMarkSum;
    }
    const passMarkSum = (data.cq_pass_mark || 0) + (data.mcq_pass_mark || 0) + (data.practical_pass_mark || 0);
    if (passMarkSum > 0) {
      pass_mark = passMarkSum;
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.subjects.update({
          where: { id },
          data: {
            name: data.name || null,
            class: data.class,
            full_mark: (full_mark ?? 0) as number,
            pass_mark: (pass_mark ?? 0) as number,
            cq_mark: (data.cq_mark ?? 0) as number,
            mcq_mark: (data.mcq_mark ?? 0) as number,
            practical_mark: (data.practical_mark ?? 0) as number,
            cq_pass_mark: (data.cq_pass_mark ?? 0) as number,
            mcq_pass_mark: (data.mcq_pass_mark ?? 0) as number,
            practical_pass_mark: (data.practical_pass_mark ?? 0) as number,
            year: data.year || new Date().getFullYear(),
            group: data.group || null,
            subject_type: data.subject_type || "single",
            parent_id: data.parent_id || null,
            assessment_type: data.assessment_type || "exam",
            marking_scheme: data.marking_scheme || "TOTAL",
            priority: (data.priority ?? 0) as number,
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
