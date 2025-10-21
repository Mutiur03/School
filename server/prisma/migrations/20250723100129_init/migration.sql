-- CreateTable
CREATE TABLE "admin" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',

    CONSTRAINT "admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" SERIAL NOT NULL,
    "login_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "father_name" VARCHAR(100),
    "mother_name" VARCHAR(100),
    "phone" CHAR(11),
    "parent_phone" CHAR(11),
    "batch" CHAR(4) NOT NULL,
    "address" TEXT,
    "dob" VARCHAR(10),
    "blood_group" VARCHAR(10),
    "has_stipend" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "password" VARCHAR(100),
    "available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_enrollments" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "class" INTEGER NOT NULL,
    "roll" INTEGER NOT NULL,
    "section" CHAR(1) NOT NULL,
    "year" INTEGER NOT NULL,
    "department" VARCHAR(100),
    "fail_count" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(100) NOT NULL DEFAULT 'Passed',
    "final_merit" INTEGER NOT NULL DEFAULT 0,
    "next_year_roll" INTEGER NOT NULL DEFAULT 0,
    "next_year_section" CHAR(1),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendence" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "status" TEXT NOT NULL,
    "send_msg" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exams" (
    "id" SERIAL NOT NULL,
    "exam_name" VARCHAR(100) NOT NULL,
    "exam_year" INTEGER NOT NULL,
    "levels" INTEGER[],
    "start_date" VARCHAR(10) NOT NULL,
    "end_date" VARCHAR(10) NOT NULL,
    "result_date" VARCHAR(10) NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" SERIAL NOT NULL,
    "title" TEXT,
    "start_date" VARCHAR(10),
    "end_date" VARCHAR(10),
    "description" TEXT,
    "is_optional" BOOLEAN,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teachers" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "phone" CHAR(11) NOT NULL,
    "subject" VARCHAR(100),
    "academic_qualification" TEXT,
    "designation" VARCHAR(100),
    "password" TEXT NOT NULL,
    "image" TEXT,
    "address" TEXT,
    "dob" VARCHAR(10),
    "blood_group" VARCHAR(10),
    "available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "levels" (
    "id" SERIAL NOT NULL,
    "class_name" INTEGER NOT NULL,
    "section" CHAR(1) NOT NULL,
    "year" INTEGER NOT NULL,
    "teacher_id" INTEGER NOT NULL,

    CONSTRAINT "levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "class" INTEGER NOT NULL,
    "full_mark" INTEGER NOT NULL DEFAULT 0,
    "pass_mark" INTEGER NOT NULL DEFAULT 0,
    "cq_mark" INTEGER NOT NULL DEFAULT 0,
    "mcq_mark" INTEGER NOT NULL DEFAULT 0,
    "practical_mark" INTEGER NOT NULL DEFAULT 0,
    "cq_pass_mark" INTEGER NOT NULL DEFAULT 0,
    "mcq_pass_mark" INTEGER NOT NULL DEFAULT 0,
    "practical_pass_mark" INTEGER NOT NULL DEFAULT 0,
    "year" INTEGER NOT NULL DEFAULT EXTRACT(year FROM CURRENT_DATE),
    "teacher_id" INTEGER,
    "department" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marks" (
    "id" SERIAL NOT NULL,
    "enrollment_id" INTEGER NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "exam_id" INTEGER NOT NULL,
    "cq_marks" INTEGER NOT NULL DEFAULT 0,
    "mcq_marks" INTEGER NOT NULL DEFAULT 0,
    "practical_marks" INTEGER NOT NULL DEFAULT 0,
    "marks" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gpa" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "jsc_gpa" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ssc_gpa" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gpa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "category" TEXT NOT NULL,
    "thumbnail" TEXT,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "date" VARCHAR(10) NOT NULL,
    "image" TEXT,
    "file" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Event',
    "location" TEXT,
    "thumbnail" TEXT,
    "public_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gallery" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER,
    "category_id" INTEGER,
    "image_path" TEXT,
    "caption" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "uploader_id" INTEGER,
    "uploader_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gallery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notices" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "file" TEXT,
    "download_url" TEXT,
    "public_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_username_key" ON "admin"("username");

-- CreateIndex
CREATE UNIQUE INDEX "students_login_id_key" ON "students"("login_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_login_id_phone_key" ON "students"("login_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "student_enrollments_student_id_class_year_key" ON "student_enrollments"("student_id", "class", "year");

-- CreateIndex
CREATE UNIQUE INDEX "exams_exam_name_exam_year_levels_key" ON "exams"("exam_name", "exam_year", "levels");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_name_class_department_year_key" ON "subjects"("name", "class", "department", "year");

-- CreateIndex
CREATE UNIQUE INDEX "marks_enrollment_id_subject_id_exam_id_key" ON "marks"("enrollment_id", "subject_id", "exam_id");

-- CreateIndex
CREATE UNIQUE INDEX "gpa_student_id_key" ON "gpa"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_category_key" ON "categories"("category");

-- AddForeignKey
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendence" ADD CONSTRAINT "attendence_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "levels" ADD CONSTRAINT "levels_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marks" ADD CONSTRAINT "marks_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "student_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marks" ADD CONSTRAINT "marks_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marks" ADD CONSTRAINT "marks_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gpa" ADD CONSTRAINT "gpa_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery" ADD CONSTRAINT "gallery_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery" ADD CONSTRAINT "gallery_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery" ADD CONSTRAINT "gallery_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
