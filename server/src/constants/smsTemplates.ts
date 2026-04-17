export const DEFAULT_SMS_TEMPLATES = {
  present_template:
    "Dear Parent,\nYour child {student_name} (ID: {login_id}) has attended school today ({date}).\nThank you.\nHead Master\n{school_name}",
  absent_template:
    "Dear Parent,\nYour child {student_name} (ID: {login_id}) is absent from school today ({date}).\nPlease contact the school office for more info.\nThank you.\n{school_name}",
  run_awayed_template:
    "Dear Parent,\nYour child {student_name} (ID: {login_id}) was present in the morning but has run awayed from school today ({date}).\nPlease check immediately.\nThank you.\n{school_name}",
} as const;
