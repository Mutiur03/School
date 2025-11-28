-- CreateTable
CREATE TABLE "admission_form" (
    "id" TEXT NOT NULL,
    "student_name_bn" VARCHAR(100),
    "student_nick_name_bn" VARCHAR(50),
    "student_name_en" VARCHAR(100),
    "birth_reg_no" VARCHAR(17),
    "father_name_bn" VARCHAR(100),
    "father_name_en" VARCHAR(100),
    "father_nid" VARCHAR(17),
    "father_phone" CHAR(11),
    "mother_name_bn" VARCHAR(100),
    "mother_name_en" VARCHAR(100),
    "mother_nid" VARCHAR(17),
    "mother_phone" CHAR(11),
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
    "guardian_phone" CHAR(11),
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
    "section_in_prev_school" VARCHAR(10),
    "roll_in_prev_school" VARCHAR(20),
    "prev_school_passing_year" VARCHAR(4),
    "father_profession" VARCHAR(100),
    "father_profession_other" VARCHAR(100),
    "mother_profession" VARCHAR(100),
    "mother_profession_other" VARCHAR(100),
    "parent_income" VARCHAR(100),
    "admission_class" VARCHAR(50),
    "list_type" VARCHAR(50),
    "admission_user_id" VARCHAR(50),
    "serial_no" VARCHAR(50),
    "qouta" VARCHAR(50),
    "photo_path" VARCHAR(255),
    "status" VARCHAR(20) DEFAULT 'pending',
    "submission_date" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admission_form_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admission_form_birth_reg_no_idx" ON "admission_form"("birth_reg_no");

-- CreateIndex
CREATE INDEX "admission_form_father_nid_idx" ON "admission_form"("father_nid");

-- CreateIndex
CREATE INDEX "admission_form_mother_nid_idx" ON "admission_form"("mother_nid");

-- CreateIndex
CREATE INDEX "admission_form_status_idx" ON "admission_form"("status");
