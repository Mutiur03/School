-- CreateTable
CREATE TABLE "class6_reg" (
    "id" SERIAL NOT NULL,
    "reg_open" BOOLEAN DEFAULT false,
    "a_sec_roll" TEXT,
    "b_sec_roll" TEXT,
    "notice" TEXT,
    "class6_year" INTEGER,
    "instruction_for_a" TEXT DEFAULT 'Please follow the instructions carefully',
    "instruction_for_b" TEXT DEFAULT 'Please follow the instructions carefully',
    "attachment_instruction" TEXT DEFAULT 'Please attach all required documents',

    CONSTRAINT "class6_reg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_registration_class6" (
    "id" TEXT NOT NULL,
    "class6_year" VARCHAR(4),
    "section" VARCHAR(10),
    "roll" VARCHAR(20),
    "religion" VARCHAR(50),
    "sorkari_brirti" VARCHAR(20),
    "student_name_bn" VARCHAR(100),
    "student_nick_name_bn" VARCHAR(50),
    "student_name_en" VARCHAR(100),
    "birth_reg_no" VARCHAR(17),
    "father_name_bn" VARCHAR(100),
    "father_name_en" VARCHAR(100),
    "father_nid" VARCHAR(17),
    "father_phone" VARCHAR(11),
    "mother_name_bn" VARCHAR(100),
    "mother_name_en" VARCHAR(100),
    "mother_nid" VARCHAR(17),
    "mother_phone" VARCHAR(11),
    "birth_date" VARCHAR(10),
    "birth_year" VARCHAR(4),
    "birth_month" VARCHAR(2),
    "birth_day" VARCHAR(2),
    "blood_group" VARCHAR(10),
    "email" VARCHAR(100),
    "present_district" VARCHAR(50),
    "present_upazila" VARCHAR(50),
    "present_post_office" VARCHAR(100),
    "present_post_code" VARCHAR(4),
    "present_village_road" VARCHAR(200),
    "permanent_district" VARCHAR(50),
    "permanent_upazila" VARCHAR(50),
    "permanent_post_office" VARCHAR(100),
    "permanent_post_code" VARCHAR(4),
    "permanent_village_road" VARCHAR(200),
    "guardian_name" VARCHAR(100),
    "guardian_phone" VARCHAR(11),
    "guardian_relation" VARCHAR(50),
    "guardian_nid" VARCHAR(17),
    "guardian_district" VARCHAR(50),
    "guardian_upazila" VARCHAR(50),
    "guardian_post_office" VARCHAR(100),
    "guardian_post_code" VARCHAR(4),
    "guardian_village_road" VARCHAR(200),
    "prev_school_name" VARCHAR(200),
    "prev_school_district" VARCHAR(50),
    "prev_school_upazila" VARCHAR(50),
    "photo_path" VARCHAR(255),
    "status" VARCHAR(20) DEFAULT 'pending',
    "submission_date" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_registration_class6_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_registration_class6_birth_reg_no_idx" ON "student_registration_class6"("birth_reg_no");

-- CreateIndex
CREATE INDEX "student_registration_class6_father_nid_idx" ON "student_registration_class6"("father_nid");

-- CreateIndex
CREATE INDEX "student_registration_class6_mother_nid_idx" ON "student_registration_class6"("mother_nid");

-- CreateIndex
CREATE INDEX "student_registration_class6_status_idx" ON "student_registration_class6"("status");

-- CreateIndex
CREATE INDEX "student_registration_class6_submission_date_idx" ON "student_registration_class6"("submission_date");
