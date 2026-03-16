-- CreateTable
CREATE TABLE "class8_reg" (
    "id" SERIAL NOT NULL,
    "reg_open" BOOLEAN DEFAULT false,
    "a_sec_roll" TEXT,
    "b_sec_roll" TEXT,
    "notice" TEXT,
    "class8_year" INTEGER,
    "instruction_for_a" TEXT DEFAULT 'Please follow the instructions carefully',
    "instruction_for_b" TEXT DEFAULT 'Please follow the instructions carefully',
    "attachment_instruction" TEXT DEFAULT 'Please attach all required documents',
    "classmates" TEXT,
    "classmates_source" TEXT NOT NULL DEFAULT 'default',

    CONSTRAINT "class8_reg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_registration_class8" (
    "id" TEXT NOT NULL,
    "section" VARCHAR(10) NOT NULL,
    "roll" VARCHAR(20) NOT NULL,
    "religion" VARCHAR(50) NOT NULL,
    "student_name_bn" VARCHAR(100) NOT NULL,
    "student_name_en" VARCHAR(100) NOT NULL,
    "birth_reg_no" VARCHAR(17) NOT NULL,
    "father_name_bn" VARCHAR(100) NOT NULL,
    "father_name_en" VARCHAR(100) NOT NULL,
    "father_nid" VARCHAR(17),
    "father_phone" VARCHAR(11),
    "mother_name_bn" VARCHAR(100) NOT NULL,
    "mother_name_en" VARCHAR(100) NOT NULL,
    "mother_nid" VARCHAR(17),
    "mother_phone" VARCHAR(11),
    "birth_date" VARCHAR(10) NOT NULL,
    "birth_year" VARCHAR(4) NOT NULL,
    "birth_month" VARCHAR(2) NOT NULL,
    "birth_day" VARCHAR(2) NOT NULL,
    "email" VARCHAR(100),
    "present_district" VARCHAR(50) NOT NULL,
    "present_upazila" VARCHAR(50) NOT NULL,
    "present_post_office" VARCHAR(100) NOT NULL,
    "present_post_code" VARCHAR(4) NOT NULL,
    "present_village_road" VARCHAR(200) NOT NULL,
    "permanent_district" VARCHAR(50) NOT NULL,
    "permanent_upazila" VARCHAR(50) NOT NULL,
    "permanent_post_office" VARCHAR(100) NOT NULL,
    "permanent_post_code" VARCHAR(4) NOT NULL,
    "permanent_village_road" VARCHAR(200) NOT NULL,
    "guardian_name" VARCHAR(100),
    "guardian_phone" VARCHAR(11),
    "guardian_relation" VARCHAR(50),
    "guardian_nid" VARCHAR(17),
    "guardian_district" VARCHAR(50),
    "guardian_upazila" VARCHAR(50),
    "guardian_post_office" VARCHAR(100),
    "guardian_post_code" VARCHAR(4),
    "guardian_village_road" VARCHAR(200),
    "prev_school_name" VARCHAR(200) NOT NULL,
    "prev_school_district" VARCHAR(50) NOT NULL,
    "prev_school_upazila" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "submission_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "photo" VARCHAR(255) NOT NULL,
    "class8_year" INTEGER NOT NULL,
    "nearby_student_info" VARCHAR(200),
    "registration_no" VARCHAR(50) NOT NULL,
    "class6_academic_session" VARCHAR(50) NOT NULL,

    CONSTRAINT "student_registration_class8_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_registration_class8_birth_reg_no_idx" ON "student_registration_class8"("birth_reg_no");

-- CreateIndex
CREATE INDEX "student_registration_class8_father_nid_idx" ON "student_registration_class8"("father_nid");

-- CreateIndex
CREATE INDEX "student_registration_class8_mother_nid_idx" ON "student_registration_class8"("mother_nid");

-- CreateIndex
CREATE INDEX "student_registration_class8_status_idx" ON "student_registration_class8"("status");

-- CreateIndex
CREATE INDEX "student_registration_class8_submission_date_idx" ON "student_registration_class8"("submission_date");
