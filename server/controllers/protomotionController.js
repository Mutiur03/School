import { prisma } from "../config/prisma.js";

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
        student: {
          include: {
            gpa: true,
          },
        },
        marks: true,
      },
    });

    // Check if students exist
    if (!students || students.length === 0) {
      return res.json({
        success: true,
        message: "No students found for the specified year",
      });
    }

    for (const student of students) {
      const {
        id: enrollmentId,
        student_id,
        class: studentClass,
        student: studentData,
      } = student;

      let failed;

      if (studentClass === 8) {
        failed = !studentData?.gpa || studentData.gpa.jsc_gpa < 2.0;
      } else {
        const failCount = await prisma.marks.count({
          where: {
            enrollment_id: enrollmentId,
            marks: { lt: 33 },
          },
        });
        failed = failCount > 0;

        await prisma.student_enrollments.update({
          where: { id: enrollmentId },
          data: { fail_count: failCount },
        });
      }

      await prisma.student_enrollments.update({
        where: { id: enrollmentId },
        data: { status: failed ? "Failed" : "Passed" },
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
        student: {
          include: {
            gpa: true,
          },
        },
        marks: true,
      },
      orderBy: [{ class: "asc" }, { department: "asc" }],
    });

    // Calculate sort values for each student
    const studentsWithMerit = students.map((student) => {
      const totalMarks = student.marks.reduce(
        (sum, mark) => sum + mark.marks,
        0
      );
      const sortValue =
        student.class === 8 ? student.student?.gpa?.jsc_gpa || 0 : totalMarks;

      return {
        ...student,
        total_marks: totalMarks,
        sort_value: sortValue,
      };
    });

    // Group by class and department for merit calculation
    const groupedStudents = {};
    studentsWithMerit.forEach((student) => {
      const key = `${student.class}-${student.department}`;
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
      if (student.class !== 8) {
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
      const [currentClass, department] = key.split("-");
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
            ? `${student.new_class}-${department}`
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
        department,
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

      await prisma.student_enrollments.create({
        data: {
          student_id,
          class: new_class,
          roll: new_roll,
          section: new_section,
          year: newYear,
          status: "Pending",
          department,
        },
      });
    }

    res.json({
      message:
        "Promotion, Merit Update & Roll Assignment Completed by Department!",
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
