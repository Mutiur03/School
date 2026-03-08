-- DropForeignKey
ALTER TABLE "subjects" DROP CONSTRAINT "subjects_teacher_id_fkey";

-- CreateIndex
CREATE INDEX "admin_username_idx" ON "admin"("username");

-- CreateIndex
CREATE INDEX "admin_role_idx" ON "admin"("role");

-- CreateIndex
CREATE INDEX "attendence_student_id_idx" ON "attendence"("student_id");

-- CreateIndex
CREATE INDEX "attendence_date_idx" ON "attendence"("date");

-- CreateIndex
CREATE INDEX "attendence_student_id_date_idx" ON "attendence"("student_id", "date");

-- CreateIndex
CREATE INDEX "attendence_status_idx" ON "attendence"("status");

-- CreateIndex
CREATE INDEX "attendence_send_msg_idx" ON "attendence"("send_msg");

-- CreateIndex
CREATE INDEX "levels_teacher_id_idx" ON "levels"("teacher_id");

-- CreateIndex
CREATE INDEX "levels_class_name_year_idx" ON "levels"("class_name", "year");

-- CreateIndex
CREATE INDEX "levels_class_name_section_year_idx" ON "levels"("class_name", "section", "year");

-- CreateIndex
CREATE INDEX "marks_enrollment_id_idx" ON "marks"("enrollment_id");

-- CreateIndex
CREATE INDEX "marks_subject_id_idx" ON "marks"("subject_id");

-- CreateIndex
CREATE INDEX "marks_exam_id_idx" ON "marks"("exam_id");

-- CreateIndex
CREATE INDEX "marks_created_at_idx" ON "marks"("created_at");

-- CreateIndex
CREATE INDEX "student_enrollments_student_id_idx" ON "student_enrollments"("student_id");

-- CreateIndex
CREATE INDEX "student_enrollments_class_year_idx" ON "student_enrollments"("class", "year");

-- CreateIndex
CREATE INDEX "student_enrollments_class_section_year_idx" ON "student_enrollments"("class", "section", "year");

-- CreateIndex
CREATE INDEX "student_enrollments_roll_class_section_year_idx" ON "student_enrollments"("roll", "class", "section", "year");

-- CreateIndex
CREATE INDEX "student_enrollments_department_idx" ON "student_enrollments"("department");

-- CreateIndex
CREATE INDEX "student_enrollments_status_idx" ON "student_enrollments"("status");

-- CreateIndex
CREATE INDEX "students_login_id_idx" ON "students"("login_id");

-- CreateIndex
CREATE INDEX "students_batch_idx" ON "students"("batch");

-- CreateIndex
CREATE INDEX "students_available_idx" ON "students"("available");

-- CreateIndex
CREATE INDEX "students_created_at_idx" ON "students"("created_at");

-- CreateIndex
CREATE INDEX "students_batch_available_idx" ON "students"("batch", "available");

-- CreateIndex
CREATE INDEX "students_father_phone_idx" ON "students"("father_phone");

-- CreateIndex
CREATE INDEX "students_mother_phone_idx" ON "students"("mother_phone");

-- CreateIndex
CREATE INDEX "subjects_teacher_id_idx" ON "subjects"("teacher_id");

-- CreateIndex
CREATE INDEX "subjects_class_year_idx" ON "subjects"("class", "year");

-- CreateIndex
CREATE INDEX "subjects_department_idx" ON "subjects"("department");

-- CreateIndex
CREATE INDEX "subjects_name_idx" ON "subjects"("name");

-- CreateIndex
CREATE INDEX "teachers_email_idx" ON "teachers"("email");

-- CreateIndex
CREATE INDEX "teachers_phone_idx" ON "teachers"("phone");

-- CreateIndex
CREATE INDEX "teachers_available_idx" ON "teachers"("available");

-- CreateIndex
CREATE INDEX "teachers_created_at_idx" ON "teachers"("created_at");

-- CreateIndex
CREATE INDEX "teachers_designation_idx" ON "teachers"("designation");
