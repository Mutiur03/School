/** Pure helpers for the admission screens (ported from dashboard/src/pages/Admin/Admission.tsx). */

const QUOTA_LABELS: Record<string, string> = {
  '(GEN)': 'সাধারণ (GEN)',
  '(DIS)': 'বিশেষ চাহিদা সম্পন্ন ছাত্র (DIS)',
  '(FF)': 'মুক্তিযোদ্ধার সন্তান (FF)',
  '(GOV)': 'সরকারী প্রাথমিক বিদ্যালয়ের ছাত্র (GOV)',
  '(ME)': 'শিক্ষা মন্ত্রণালয়ের কর্মকর্তা-কর্মচারী (ME)',
  '(SIB)': 'সহোদর ভাই (SIB)',
  '(TWN)': 'যমজ (TWN)',
  '(Mutual Transfer)': 'পারস্পরিক বদলি (Mutual Transfer)',
  '(Govt. Transfer)': 'সরকারি বদলি (Govt. Transfer)',
};

export function formatQuota(q?: string): string | null {
  if (!q) return null;
  const n = q.replace(/\s+/g, ' ').trim();
  return QUOTA_LABELS[n] ?? QUOTA_LABELS[`(${n.replace(/[()]/g, '').trim()})`] ?? n;
}

const INCOME_LABELS: Record<string, string> = {
  below_50000: '0 - 50,000',
  '50000_100000': '50,000 - 100,000',
  '100001_200000': '100,001 - 200,000',
  '200001_500000': '200,001 - 500,000',
  above_500000: 'Above 500,000',
};

export function formatIncome(p?: string): string | null {
  if (!p) return null;
  const key = p.trim();
  return INCOME_LABELS[key] ?? key.replace(/_/g, ' ').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "12/05/2015" or "2015-05-12" → "12 May 2015"; anything else as-is. Timezone-safe. */
export function formatDateLong(s?: string): string | null {
  if (!s) return null;
  let d: string, m: string, y: string;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) [d, m, y] = s.split('/') as [string, string, string];
  else if (/^\d{4}-\d{2}-\d{2}/.test(s))
    [y, m, d] = s.slice(0, 10).split('-') as [string, string, string];
  else return s;
  const month = MONTHS[Number(m) - 1];
  return month && Number(d) >= 1 && Number(d) <= 31 ? `${Number(d)} ${month} ${y}` : s;
}

/** Class list from the settings: a comma list, or one class per line (first column). */
export function parseClassList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw !== 'string' || !raw.trim()) return [];
  const rows = raw
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter(Boolean);
  const split = (r: string) =>
    r
      .split(/[,;]+/)
      .map((x) => x.trim())
      .filter(Boolean);
  return rows.length === 1 ? split(rows[0]!) : rows.map((r) => split(r)[0]!).filter(Boolean);
}

export const joinParts = (...parts: (string | null | undefined)[]) =>
  parts.filter(Boolean).join(', ') || null;

export function addressOf(f: Record<string, string>, prefix: 'present' | 'permanent' | 'guardian') {
  const get = (k: string) => f[`${prefix}_${k}`];
  const post = [get('post_office'), get('post_code')].filter(Boolean).join('-');
  return joinParts(get('village_road'), post, get('upazila'), get('district'));
}

export type DetailSection = readonly [
  string,
  readonly (readonly [string, string | null | undefined])[],
];

/** The web's admission detail sections, in order. */
export function admissionSections(f: Record<string, string>): DetailSection[] {
  const hasGuardian = !!(f.guardian_name || f.guardian_phone);
  return [
    [
      'Admission',
      [
        ['Class', f.admission_class],
        ['List type', f.list_type],
        ['User ID', f.admission_user_id],
        ['Serial no', f.serial_no],
        ['Quota', formatQuota(f.qouta)],
      ],
    ],
    [
      'Personal',
      [
        ['Name (Bangla)', f.student_name_bn],
        ['Nickname', f.student_nick_name_bn],
        ['Birth reg. no', f.birth_reg_no],
        ['Registration no', f.registration_no],
        ['Date of birth', formatDateLong(f.birth_date)],
        ['Blood group', f.blood_group],
        ['Email', f.email],
        ['Religion', f.religion],
        ['WhatsApp', f.whatsapp_number],
      ],
    ],
    [
      'Parents',
      [
        ['Father', joinParts(f.father_name_bn, f.father_name_en)],
        ['Father NID', f.father_nid],
        ['Father phone', f.father_phone],
        ['Father profession', f.father_profession],
        ['Mother', joinParts(f.mother_name_bn, f.mother_name_en)],
        ['Mother NID', f.mother_nid],
        ['Mother phone', f.mother_phone],
        ['Mother profession', f.mother_profession],
        ['Annual income', formatIncome(f.parent_income)],
      ],
    ],
    [
      'Address',
      [
        ['Present', addressOf(f, 'present')],
        ['Permanent', addressOf(f, 'permanent')],
      ],
    ],
    [
      'Previous school',
      [
        ['School', f.prev_school_name],
        ['School location', joinParts(f.prev_school_upazila, f.prev_school_district)],
        ['Section / roll', joinParts(f.section_in_prev_school, f.roll_in_prev_school)],
        ['Passing year', f.prev_school_passing_year],
      ],
    ],
    [
      'Guardian',
      hasGuardian
        ? [
            [
              'Name',
              joinParts(f.guardian_name, f.guardian_relation ? `(${f.guardian_relation})` : null),
            ],
            ['Phone', f.guardian_phone],
            ['NID', f.guardian_nid],
            ['Address', addressOf(f, 'guardian')],
          ]
        : [['Guardian', 'Parents (no separate guardian)']],
    ],
  ];
}

/** The web's registration detail sections (ClassRegForm detailRows), per variant. */
export function registrationSections(
  variant: 'class-6' | 'class-8' | 'class-9' | 'junior-scholarship',
  f: Record<string, string>,
): DetailSection[] {
  const nine = variant === 'class-9';
  const academic: (readonly [string, string | null | undefined])[] = [
    ['Previous school', f.prev_school_name],
    ['School location', joinParts(f.prev_school_upazila, f.prev_school_district)],
  ];
  if (variant === 'class-6') {
    academic.push(
      ['Section / roll', joinParts(f.section_in_prev_school, f.roll_in_prev_school)],
      ['Passing year', f.prev_school_passing_year],
    );
  } else if (nine) {
    academic.push(
      ['Group', f.group_class_nine],
      ['Main subject', f.main_subject],
      ['4th subject', f.fourth_subject],
      ['JSC year', f.jsc_passing_year],
      ['JSC ID / roll', f.jsc_roll_no],
      ['JSC reg. no', f.jsc_reg_no],
    );
  } else {
    academic.push(
      ['Class 6 reg. year', f.class6_reg_year],
      ['Class 6 board', f.class6_board],
      ['Class 6 reg. no', f.class6_reg_no],
      ['Class 6 ID / roll', f.class6_roll_no],
    );
  }
  return [
    [
      'Personal',
      [
        ['Name (Bangla)', f.student_name_bn],
        ...(nine ? [['Nickname', f.student_nick_name_bn] as const] : []),
        ['Birth reg. no', f.birth_reg_no],
        ['Date of birth', f.birth_date],
        nine
          ? (['Blood group', f.blood_group] as const)
          : (['Scout', f.scout_status || 'No'] as const),
        ['Email', f.email],
        ['Father phone', f.father_phone],
        ['Mother phone', f.mother_phone],
      ],
    ],
    [
      'Parents',
      [
        ['Father', joinParts(f.father_name_bn, f.father_name_en)],
        ['Father NID', f.father_nid],
        ['Mother', joinParts(f.mother_name_bn, f.mother_name_en)],
        ['Mother NID', f.mother_nid],
      ],
    ],
    [
      'Address',
      [
        ['Present', addressOf(f, 'present')],
        ['Permanent', addressOf(f, 'permanent')],
        [
          'Nearby student',
          (nine ? f.nearby_nine_student_info : f.nearby_student_info) || 'Not applicable',
        ],
      ],
    ],
    ['Education', academic],
    [
      'Guardian',
      f.guardian_name
        ? [
            [
              'Name',
              joinParts(f.guardian_name, f.guardian_relation ? `(${f.guardian_relation})` : null),
            ],
            ['Phone', f.guardian_phone],
            ['NID', f.guardian_nid],
            ['Address', addressOf(f, 'guardian')],
          ]
        : [['Guardian', 'Parents (no separate guardian)']],
    ],
  ];
}
