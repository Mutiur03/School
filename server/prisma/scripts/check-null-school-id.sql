-- Run BEFORE the require-school_id migration. Any row returned = must backfill first.
-- (SET NOT NULL fails if any school_id IS NULL.)
SELECT 'admin' AS table_name, count(*) AS null_rows FROM admin WHERE school_id IS NULL
UNION ALL SELECT 'students', count(*) FROM students WHERE school_id IS NULL
UNION ALL SELECT 'student_enrollments', count(*) FROM student_enrollments WHERE school_id IS NULL
UNION ALL SELECT 'attendence', count(*) FROM attendence WHERE school_id IS NULL
UNION ALL SELECT 'exams', count(*) FROM exams WHERE school_id IS NULL
UNION ALL SELECT 'exam_class_stats', count(*) FROM exam_class_stats WHERE school_id IS NULL
UNION ALL SELECT 'marksheet_files', count(*) FROM marksheet_files WHERE school_id IS NULL
UNION ALL SELECT 'marksheet_bundles', count(*) FROM marksheet_bundles WHERE school_id IS NULL
UNION ALL SELECT 'holidays', count(*) FROM holidays WHERE school_id IS NULL
UNION ALL SELECT 'teachers', count(*) FROM teachers WHERE school_id IS NULL
UNION ALL SELECT 'staffs', count(*) FROM staffs WHERE school_id IS NULL
UNION ALL SELECT 'levels', count(*) FROM levels WHERE school_id IS NULL
UNION ALL SELECT 'subjects', count(*) FROM subjects WHERE school_id IS NULL
UNION ALL SELECT 'marks', count(*) FROM marks WHERE school_id IS NULL
UNION ALL SELECT 'categories', count(*) FROM categories WHERE school_id IS NULL
UNION ALL SELECT 'events', count(*) FROM events WHERE school_id IS NULL
UNION ALL SELECT 'gallery', count(*) FROM gallery WHERE school_id IS NULL
UNION ALL SELECT 'notices', count(*) FROM notices WHERE school_id IS NULL
UNION ALL SELECT 'admission', count(*) FROM admission WHERE school_id IS NULL
UNION ALL SELECT 'syllabus', count(*) FROM syllabus WHERE school_id IS NULL
UNION ALL SELECT 'class_slot_time', count(*) FROM class_slot_time WHERE school_id IS NULL
UNION ALL SELECT 'class_routine', count(*) FROM class_routine WHERE school_id IS NULL
UNION ALL SELECT 'exam_routines', count(*) FROM exam_routines WHERE school_id IS NULL
UNION ALL SELECT 'class_routine_pdf', count(*) FROM class_routine_pdf WHERE school_id IS NULL
UNION ALL SELECT 'CitizenCharter', count(*) FROM "CitizenCharter" WHERE school_id IS NULL
UNION ALL SELECT 'head_msg', count(*) FROM head_msg WHERE school_id IS NULL
UNION ALL SELECT 'ssc_reg', count(*) FROM ssc_reg WHERE school_id IS NULL
UNION ALL SELECT 'student_registration_ssc', count(*) FROM student_registration_ssc WHERE school_id IS NULL
UNION ALL SELECT 'admission_form', count(*) FROM admission_form WHERE school_id IS NULL
UNION ALL SELECT 'admission_result', count(*) FROM admission_result WHERE school_id IS NULL
UNION ALL SELECT 'sms_logs', count(*) FROM sms_logs WHERE school_id IS NULL
UNION ALL SELECT 'class6_reg', count(*) FROM class6_reg WHERE school_id IS NULL
UNION ALL SELECT 'student_registration_class6', count(*) FROM student_registration_class6 WHERE school_id IS NULL
UNION ALL SELECT 'class8_reg', count(*) FROM class8_reg WHERE school_id IS NULL
UNION ALL SELECT 'student_registration_class8', count(*) FROM student_registration_class8 WHERE school_id IS NULL
ORDER BY null_rows DESC;
