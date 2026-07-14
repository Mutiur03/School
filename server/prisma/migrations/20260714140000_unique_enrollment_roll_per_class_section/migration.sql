-- Enforce unique roll within class + section + year per school.
-- Fails if duplicate (school_id, year, class, section, roll) rows already exist.
CREATE UNIQUE INDEX "enrollment_school_year_class_section_roll"
ON "student_enrollments"("school_id", "year", "class", "section", "roll");
