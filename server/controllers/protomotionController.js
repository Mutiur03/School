import pool from "../config/db.js";

export const passStatusController = async (req, res) => {
  try {
    const { year } = req.params;

    // Find all students for the given year
    const students = await pool.query(
      `SELECT DISTINCT se.id, se.student_id, se.class, se.roll, se.section, se.year, se.department, gpa.jsc_gpa
       FROM student_enrollments se
       LEFT JOIN gpa ON se.student_id = gpa.student_id
       LEFT JOIN marks m ON se.id = m.enrollment_id
       WHERE se.year = $1`,
      [year]
    );

    for (const student of students.rows) {
      const {
        id: enrollmentId,
        student_id,
        class: studentClass,
        jsc_gpa,
      } = student;
      console.log("Processing student:", student_id, "Class:", studentClass);

      let failed;

      if (studentClass === 8) {
        // Use GPA for class 8 students
        console.log("Class 8 student:", student_id, "GPA:", jsc_gpa);
        failed = jsc_gpa < 2.0; // Assuming GPA below 2.0 is considered failed
      } else {
        // Check if student failed in any subject
        const failCheck = await pool.query(
          `SELECT COUNT(*) AS fail_count FROM marks
           WHERE enrollment_id = $1 AND marks < 33`,
          [enrollmentId]
        );
        failed = failCheck.rows[0].fail_count > 0;

        // Update fail count for non-class 8 students
        await pool.query(
          `UPDATE student_enrollments 
           SET fail_count = $1 
           WHERE id = $2`,
          [failCheck.rows[0].fail_count, enrollmentId]
        );
      }

      // Update student status
      await pool.query(
        `UPDATE student_enrollments 
         SET status = $1 
         WHERE id = $2`,
        [failed ? "Failed" : "Passed", enrollmentId]
      );
    }

    res.json({ success: true, message: "Pass/Fail status updated!" });
  } catch (error) {
    res.status(500).json(error);
  }
};

export const promoteStudentController = async (req, res) => {
  try {
    const { year } = req.params;
    const newYear = parseInt(year) + 1;

    console.log("Promoting students for year:", year);

    // Fetch students along with their total marks and merit rank per class & department
    const students = await pool.query(
      `SELECT se.id AS enrollment_id, se.student_id, se.class AS current_class, 
              se.status, se.department, se.section,
              COALESCE(SUM(m.marks), 0) AS total_marks,
              gpa.jsc_gpa,
              RANK() OVER (  
                PARTITION BY se.class, se.department 
                ORDER BY 
                  CASE 
                    WHEN se.class = 8 THEN gpa.jsc_gpa 
                    ELSE COALESCE(SUM(m.marks), 0) 
                  END DESC
              ) AS final_merit
       FROM student_enrollments se
       LEFT JOIN students s ON se.student_id = s.id
       LEFT JOIN marks m ON se.id = m.enrollment_id
       LEFT JOIN gpa ON se.student_id = gpa.student_id
       WHERE se.year = $1 AND se.class IN (6, 7, 8, 9) AND s.available = true
       GROUP BY se.id, se.student_id, se.class, se.status, se.department, gpa.jsc_gpa
       ORDER BY se.class, se.department, se.status DESC, final_merit`,
      [year]
    );

    // Update final_merit for classes 6, 7, and 9 students
    for (const student of students.rows) {
      if (student.current_class !== 8) {
        await pool.query(
          `UPDATE student_enrollments 
           SET final_merit = $1 
           WHERE id = $2`,
          [student.final_merit, student.enrollment_id]
        );
      }
    }

    // Clear existing enrollments for the upcoming year
    await pool.query(`DELETE FROM student_enrollments WHERE year = $1`, [
      newYear,
    ]);

    // Track roll numbers for each class
    const classRollCounters = {}; // key: `${class}`

    for (const student of students.rows) {
      const {
        enrollment_id,
        student_id,
        current_class: currentClass,
        status,
        department,
        section,
        jsc_gpa,
      } = student;

      let newClass, rollNumber, newSection;

      if (currentClass === 8) {
        // Class 8: Use GPA for roll assignment, reassign roll, keep section unchanged
        newClass = status === "Passed" ? 9 : 8;
        const key = `${newClass}-${section}`; // Separate roll counters by section

        if (!classRollCounters[key]) {
          classRollCounters[key] = 1; // Single counter for promoted students
        }

        rollNumber = classRollCounters[key]++;
        newSection = section; // Keep the same section
      } else {
        // Classes 6, 7, 9: Use marks for roll assignment
        newClass =
          status === "Passed"
            ? parseInt(currentClass) + 1
            : parseInt(currentClass);

        const sectionAKey = `${newClass}-A`;
        const sectionBKey = `${newClass}-B`;

        if (!classRollCounters[sectionAKey]) {
          classRollCounters[sectionAKey] = 1; // Counter for section A
        }
        if (!classRollCounters[sectionBKey]) {
          classRollCounters[sectionBKey] = 1; // Counter for section B
        }

        if (status === "Passed") {
          // Assign rolls for promoted students
          if (!classRollCounters[`${newClass}-Promoted`]) {
            classRollCounters[`${newClass}-Promoted`] = {
              A: classRollCounters[sectionAKey],
              B: classRollCounters[sectionBKey],
            };
          }
          if (
            classRollCounters[sectionAKey] <= classRollCounters[sectionBKey]
          ) {
            rollNumber = classRollCounters[sectionAKey]++;
            newSection = "A";
          } else {
            rollNumber = classRollCounters[sectionBKey]++;
            newSection = "B";
          }
        } else {
          // Assign rolls for failed students starting from the minimum ending roll of both sections
          const failedStartRoll = Math.max(
            classRollCounters[sectionAKey],
            classRollCounters[sectionBKey]
          );

          if (!classRollCounters[`${newClass}-Failed`]) {
            classRollCounters[`${newClass}-Failed`] = {
              A: failedStartRoll,
              B: failedStartRoll,
            };
          }

          if (
            classRollCounters[`${newClass}-Failed`].A <=
            classRollCounters[`${newClass}-Failed`].B
          ) {
            rollNumber = classRollCounters[`${newClass}-Failed`].A++;
            newSection = "A";
          } else {
            rollNumber = classRollCounters[`${newClass}-Failed`].B++;
            newSection = "B";
          }
        }
      }

      console.log(
        "Roll Number:",
        rollNumber,
        "Section:",
        newSection,
        "for",
        student_id
      );

      try {
        await pool.query(
          `UPDATE student_enrollments 
           SET next_year_section = $1, 
               next_year_roll = $2
           WHERE id = $3`,
          [newSection, rollNumber, enrollment_id]
        );
      } catch (error) {
        console.error("Error assigning roll number:", error);
      }

      console.log("Inserting new enrollment:", {
        student_id,
        newClass,
        rollNumber,
        newSection,
        year: newYear,
        department,
      });

      await pool.query(
        `INSERT INTO student_enrollments 
         (student_id, class, roll, section, year, status, department)
         VALUES ($1, $2, $3, $4, $5, 'Pending', $6)`,
        [student_id, newClass, rollNumber, newSection, newYear, department]
      );
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

    const result = await pool.query(
      `UPDATE student_enrollments 
         SET status = $1 
         WHERE id = $2`,
      [status, id]
    );

    if (result.rowCount > 0) {
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
