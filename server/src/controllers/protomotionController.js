import { prisma } from "../config/prisma.js";
import { SubjectService } from "../modules/result/subject/subject.service.js";
import { MarksService } from "../modules/marks/marks.service.js";

export const passStatusController = async (req, res) => {
  try {
    const { year } = req.params;

    // Validate year parameter
    if (!year || isNaN(parseInt(year))) {
      return res.status(400).json({
        success: false,
        error: "Invalid year parameter",
      });
    }

    const students = await prisma.student_enrollments.findMany({
      where: { year: parseInt(year) },
      include: {
        student: true,
        marks: {
          include: {
            subject: {
              include: { parent: true }
            }
          }
        },
      },
    });

    // Check if students exist
    if (!students || students.length === 0) {
      return res.json({
        success: true,
        message: "No students found for the specified year",
      });
    }

    // Pre-calculate bonus status for all classes in this year to avoid redundant DB calls
    const classBonusStatus = {};
    const classes = [...new Set(students.map(s => s.class))];
    for (const c of classes) {
      classBonusStatus[c] = await MarksService.shouldApplyFourthSubjectBonus(c, parseInt(year));
    }

    for (const student of students) {
      const {
        id: enrollmentId,
        student_id: _student_id,
        class: studentClass,
        marks: rawMarks,
      } = student;

      // Ensure marks have subjects included (we already included them in findMany below)
      const processedMarks = MarksService.aggregatePaperMarks(student.marks);
      const { gpa, isFailed, totalMarks } = MarksService.calculateGPA(
        processedMarks,
        student.fourth_subject_id || null,
        classBonusStatus[studentClass],
        studentClass
      );

      await prisma.student_enrollments.update({
        where: { id: enrollmentId },
        data: { 
          status: isFailed ? "Failed" : "Passed",
          // Optionally update GPA/Total marks in the enrollment for easier merit list viewing
          // gpa, 
          // total_marks: totalMarks 
        },
      });
    }

    res.json({ success: true, message: "Pass/Fail status updated!" });
  } catch (error) {
    console.error("Error in passStatusController:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
};

export const promoteStudentController = async (req, res) => {
  try {
    const { year } = req.params;
    const newYear = parseInt(year) + 1;

    const students = await prisma.student_enrollments.findMany({
      where: {
        year: parseInt(year),
        class: { in: [6, 7, 8, 9] },
        student: { available: true },
      },
      include: {
        student: true,
        marks: {
          include: {
            subject: {
              include: { parent: true }
            },
          },
        },
      },
      orderBy: [{ class: "asc" }, { group: "asc" }],
    });

    // Check if subjects exist for the new year, if not clone them
    const subjectsExistInNewYear = await prisma.subjects.count({
      where: { year: newYear },
    });

    let subjectMapping = {};
    if (subjectsExistInNewYear === 0) {
      const cloningResult = await SubjectService.cloneSubjects(
        parseInt(year),
        newYear,
      );
      if (cloningResult.success) {
        subjectMapping = cloningResult.mapping;
      }
    } else {
      // If subjects already exist, we might want to build a mapping by name for 4th subjects
      // but the requirement "if not clones" suggests we only care about auto-cloning.
      // However, for 4th subjects to work, we need a mapping.
      // Let's at least try to map by name/class/group if mapping is empty.
      const currentSubjects = await prisma.subjects.findMany({ where: { year: parseInt(year) } });
      const nextSubjects = await prisma.subjects.findMany({ where: { year: newYear } });
      
      currentSubjects.forEach(oldSub => {
        const matchingNewSub = nextSubjects.find(newSub => 
          newSub.name === oldSub.name && 
          newSub.class === oldSub.class && 
          newSub.group === oldSub.group
        );
        if (matchingNewSub) {
          subjectMapping[oldSub.id] = matchingNewSub.id;
        }
      });
    }

    // Group students by class to check class-wide bonus status
    const classBonusStatus = {};

    // First pass: identify which classes should have the bonus
    const classYears = new Set(
      students.map((s) => `${s.class}-${s.year}`)
    );
    for (const cy of classYears) {
      const [c, y] = cy.split("-");
      classBonusStatus[cy] = await MarksService.shouldApplyFourthSubjectBonus(
        parseInt(c),
        parseInt(y)
      );
    }

    // Calculate sort values (GPA) for each student
    const studentsWithMerit = students.map((student) => {
      const applyBonus = classBonusStatus[`${student.class}-${student.year}`];

      // Format marks for calculateGPA (using MarksService.aggregatePaperMarks)
      const processedMarks = MarksService.aggregatePaperMarks(student.marks);

      const { gpa, totalMarks, isFailed } = MarksService.calculateGPA(
        processedMarks,
        student.fourth_subject_id || null,
        applyBonus,
        student.class
      );

      return {
        ...student,
        total_marks: totalMarks,
        gpa: gpa,
        sort_value: gpa, // Sort by GPA primarily
      };
    });

    // Group by class and group for merit calculation
    const groupedStudents = {};
    studentsWithMerit.forEach((student) => {
      const key = `${student.class}-${student.group}`;
      if (!groupedStudents[key]) {
        groupedStudents[key] = [];
      }
      groupedStudents[key].push(student);
    });

    // Calculate merit within each group - passed students first, then failed
    Object.keys(groupedStudents).forEach((key) => {
      const group = groupedStudents[key];

      // Separate passed and failed students
      const passedStudents = group.filter((s) => s.status === "Passed");
      const failedStudents = group.filter((s) => s.status === "Failed");

      // Sort passed students: by sort_value (desc), then by section (A first), then by roll (asc)
      passedStudents.sort((a, b) => {
        if (b.sort_value !== a.sort_value) {
          return b.sort_value - a.sort_value;
        }
        // If GPA is tied, sort by total marks
        if (b.total_marks !== a.total_marks) {
          return b.total_marks - a.total_marks;
        }
        if (a.section !== b.section) {
          return a.section === "A" ? -1 : 1; // A section gets priority
        }
        return a.roll - b.roll;
      });

      // Sort failed students: by sort_value (desc), then by section (A first), then by roll (asc)
      failedStudents.sort((a, b) => {
        if (b.sort_value !== a.sort_value) {
          return b.sort_value - a.sort_value;
        }
        // If GPA is tied, sort by total marks
        if (b.total_marks !== a.total_marks) {
          return b.total_marks - a.total_marks;
        }
        if (a.section !== b.section) {
          return a.section === "A" ? -1 : 1; // A section gets priority
        }
        return a.roll - b.roll;
      });

      // Combine: passed students first, then failed students
      const sortedGroup = [...passedStudents, ...failedStudents];

      // Assign merit positions - ensure sequential merit assignment
      for (let i = 0; i < sortedGroup.length; i++) {
        sortedGroup[i].final_merit = i + 1;
      }

      // Update the original group with merit assignments
      groupedStudents[key] = sortedGroup;
    });

    // Update merit in database for non-class-8 students
    for (const student of studentsWithMerit) {
      if (student.class !== 127) { // Always update merit since GPA is gone
        await prisma.student_enrollments.update({
          where: { id: student.id },
          data: { final_merit: student.final_merit },
        });
      }
    }

    await prisma.student_enrollments.deleteMany({
      where: { year: newYear },
    });

    // Roll assignment logic
    const rollCounters = {};

    // Process all classes and assign rolls based on merit
    Object.keys(groupedStudents).forEach((key) => {
      const [currentClass, groupName] = key.split("-");
      const classNum = parseInt(currentClass);
      const group = groupedStudents[key];

      // Determine new class for each student
      group.forEach((student) => {
        if (student.status === "Passed") {
          student.new_class = classNum === 8 ? 9 : classNum + 1;
        } else {
          student.new_class = classNum; // Failed students repeat
        }
      });

      // Group students by their new class for roll assignment
      const newClassGroups = {};
      group.forEach((student) => {
        const newClassKey =
          classNum === 9 && student.new_class === 10
            ? `${student.new_class}-${groupName}`
            : `${student.new_class}`;

        if (!newClassGroups[newClassKey]) {
          newClassGroups[newClassKey] = [];
        }
        newClassGroups[newClassKey].push(student);
      });

      // Assign rolls within each new class group
      Object.keys(newClassGroups).forEach((newClassKey) => {
        if (!rollCounters[newClassKey]) {
          rollCounters[newClassKey] = { A: 1, B: 1 };
        }

        const newClassGroup = newClassGroups[newClassKey];

        // Sort by merit to ensure proper order
        newClassGroup.sort((a, b) => a.final_merit - b.final_merit);

        newClassGroup.forEach((student) => {
          const isOddMerit = student.final_merit % 2 === 1;
          const newSection = isOddMerit ? "A" : "B";
          const rollNumber = rollCounters[newClassKey][newSection]++;

          student.new_section = newSection;
          student.new_roll = rollNumber;
        });
      });
    });

    // Update database with new roll assignments and create new enrollments
    for (const student of studentsWithMerit) {
      const {
        id: enrollment_id,
        student_id,
        group,
        new_class,
        new_section,
        new_roll,
      } = student;

      // Ensure we have valid values before database operations
      if (!new_class || !new_section || !new_roll) {
        console.error(`Missing required fields for student ${student_id}:`, {
          new_class,
          new_section,
          new_roll,
        });
        continue;
      }

      try {
        await prisma.student_enrollments.update({
          where: { id: enrollment_id },
          data: {
            next_year_section: new_section,
            next_year_roll: new_roll,
          },
        });
      } catch (error) {
        console.error("Error assigning roll number:", error);
      }

      const oldFourthSubjectId = student.fourth_subject_id;
      const newFourthSubjectId = subjectMapping[oldFourthSubjectId] || null;

      await prisma.student_enrollments.create({
        data: {
          student_id,
          class: new_class,
          roll: new_roll,
          section: new_section,
          year: newYear,
          status: "Pending",
          group,
          fourth_subject_id: newFourthSubjectId,
        },
      });
    }

    res.json({
      message:
        "Promotion, Merit Update & Roll Assignment Completed by Group!",
    });
  } catch (error) {
    console.error("Error promoting students:", error);
    res.status(500).json({ error: error.message });
  }
};

export const updateStatus = async (req, res) => {
  try {
    const { status, id } = req.body;

    const result = await prisma.student_enrollments.update({
      where: { id },
      data: { status },
    });

    if (result) {
      res.json({ success: true, message: "Status updated successfully!" });
    } else {
      res
        .status(404)
        .json({ success: false, message: "Enrollment not found!" });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
