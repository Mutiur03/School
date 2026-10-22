// Sample non-marksheet PDFs: fees (receipt + reports), testimonials, registration forms, admission
// form, attendance sheet and the student form. No DB/Redis: a fake prisma (the mocked
// `@/config/prisma.js` object) and stubbed services feed the real generators. The HTML ones need
// Chrome (PUPPETEER_EXECUTABLE_PATH or the puppeteer download).
import type { PdfSampleGroup } from './types.js';

const SCHOOL_ID = 1;
const schoolRow = {
  name: 'Panchbibi Model High School',
  nameBn: 'পাঁচবিবি মডেল হাই স্কুল',
  eiin: '123456',
  schoolCode: '7890',
  upazila: 'Panchbibi',
  district: 'Joypurhat',
  customDomain: 'www.example.edu.bd',
  subdomain: 'sample',
  ownership: 'Government',
  logo: null,
  board: 'Rajshahi Education Board',
  gender: 'Boys',
};

/** Any field the generator reads that is not listed comes back as "Sample <field>". */
const sampleRow = (fixed: Record<string, unknown>) =>
  new Proxy(fixed, {
    get: (t, k) => (k in t ? t[k as string] : typeof k === 'string' ? `Sample ${k}` : undefined),
  });

const fixedPerson = {
  student_name_bn: 'রহিম উদ্দিন',
  student_name_en: 'Rahim Uddin',
  father_name_bn: 'করিম উদ্দিন',
  father_name_en: 'Karim Uddin',
  mother_name_bn: 'রহিমা বেগম',
  mother_name_en: 'Rahima Begum',
  birth_date: '2013-05-14',
  birth_reg_no: '20130000000000001',
  father_nid: '1234567890',
  mother_nid: '1234567891',
  father_phone: '01711111111',
  mother_phone: '01722222222',
  email: 'rahim@example.com',
  religion: 'Islam',
  section: 'A',
  roll: 12,
};

export async function otherSamples(): Promise<PdfSampleGroup[]> {
  const { prisma } = (await import('@/config/prisma.js')) as { prisma: any };
  const { runWithRlsContext } = await import('@/config/rlsContextStore.js');
  const inSchool = <T>(fn: () => T) =>
    runWithRlsContext({ schoolId: SCHOOL_ID, isSuperAdmin: false }, fn);

  // ---- fees (puppeteer) ----
  const feeSamples = async () => {
    const { FeeReceiptPdfService } =
      await import('@/nest/modules/fees/fee-receipt/fee-receipt-pdf.service.js');
    const { FeeReportService } =
      await import('@/nest/modules/fees/fee-report/fee-report.service.js');
    const db = { school: { findUnique: async () => schoolRow } } as any;
    const receipt = {
      id: 1,
      receipt_no: 1042,
      date: '2026-03-14',
      year: 2026,
      class: 7,
      section: 'A',
      roll: 12,
      total: 1700,
      note: 'Paid by guardian',
      student: { id: 1, name: 'Rahim Uddin', login_id: 260712 },
      accounts: [
        { id: 1, name: 'Cash', amount: 1200 },
        { id: 2, name: 'Bank', amount: 500 },
      ],
      voucher_id: 9,
      voucher_no: 'RV-9',
      items: [
        {
          fee_head_id: 1,
          fee_head: 'Tuition fee',
          month: 3,
          charge: 800,
          waiver: 100,
          amount: 700,
        },
        {
          fee_head_id: 2,
          fee_head: 'Exam fee',
          month: null,
          charge: 1000,
          waiver: 0,
          amount: 1000,
        },
      ],
    };
    const receipts = new FeeReceiptPdfService(db, { findOne: async () => receipt } as any);
    const reports = new FeeReportService(db) as any;
    reports.collection = async () => ({
      from: '2026-03-01',
      to: '2026-03-31',
      total: 42500,
      count: 31,
      by_day: [
        { date: '2026-03-14', count: 12, total: 18000 },
        { date: '2026-03-15', count: 19, total: 24500 },
      ],
      by_class: [
        { class: 6, count: 10, total: 12000 },
        { class: 7, count: 21, total: 30500 },
      ],
      by_account: [
        { deposit_head_id: 1, name: 'Cash', total: 30000 },
        { deposit_head_id: 2, name: 'Bank', total: 12500 },
      ],
      by_head: [
        { fee_head_id: 1, name: 'Exam fee', count: 20, waiver: 0, total: 20000 },
        { fee_head_id: 2, name: 'Tuition fee', count: 31, waiver: 500, total: 22500 },
      ],
    });
    reports.dues = async () => ({
      year: 2026,
      class: 7,
      section: 'A',
      upto_month: 3,
      rows: Array.from({ length: 6 }, (_, i) => ({
        name: `Student Number ${i + 1}`,
        login_id: 260700 + i,
        section: 'A',
        roll: i + 1,
        charge: 3000,
        waiver: 200,
        paid: 1000 * (i % 3),
        due: 1800 - 600 * (i % 3),
      })),
      total_due: 6300,
    });
    return [
      { name: 'receipt', make: async () => (await receipts.generate(SCHOOL_ID, 1)).buffer },
      {
        name: 'collection_report',
        make: async () =>
          (await reports.collectionPdf(SCHOOL_ID, { from: '2026-03-01', to: '2026-03-31' })).buffer,
      },
      {
        name: 'dues_report',
        make: async () => (await reports.duesPdf(SCHOOL_ID, { year: 2026, class: 7 })).buffer,
      },
    ];
  };

  // ---- testimonials (puppeteer) ----
  const certificateSamples = async () => {
    const { CertificatePdfService } =
      await import('@/nest/modules/certificate/certificate-pdf.service.js');
    const svc = (over: Record<string, unknown>) =>
      new CertificatePdfService({
        school: { findUnique: async () => ({ ...schoolRow, ...over }) },
      } as any);
    const base = {
      student_name_bn: 'রহিম উদ্দিন',
      student_name_en: 'Rahim Uddin',
      father_name_bn: 'করিম উদ্দিন',
      father_name_en: 'Karim Uddin',
      mother_name_bn: 'রহিমা বেগম',
      mother_name_en: 'Rahima Begum',
      address_district: 'Joypurhat',
      address_upazila: 'Panchbibi',
      address_post_office: 'Panchbibi',
      address_post_office_bn: 'পাঁচবিবি',
      address_post_code: '5920',
      address_village_road: 'Main Road',
      address_village_road_bn: 'মেইন রোড',
      mobile: '01711111111',
      birth_reg_no: '20050000000000001',
      dob: '2005-03-20',
    };
    const t = (d: Record<string, unknown>) => ({ ...base, ...d }) as any;
    const gen =
      (over: Record<string, unknown>, d: Record<string, unknown>, addr: boolean, pending = false) =>
      async () =>
        svc(over).generate(SCHOOL_ID, t(d), addr, pending);
    return [
      {
        name: 'board_ssc_government_with_address',
        make: gen(
          {},
          {
            kind: 'board',
            exam: 'SSC',
            passing_year: 2022,
            roll: '123456',
            registration_no: '1234567890',
            gpa: '4.83',
            gender: 'Male',
          },
          true,
        ),
      },
      {
        name: 'board_jsc_nongovt_pending_no_address',
        make: gen(
          { ownership: 'Non-Government', gender: 'Girls' },
          {
            kind: 'board',
            exam: 'JSC',
            passing_year: 2015,
            roll: '123456',
            registration_no: '1234567890',
            gpa: '4.50',
            gender: 'Female',
          },
          false,
          true,
        ),
      },
      {
        name: 'class6_government',
        make: gen({}, { kind: 'class', exam: '6', passing_year: 2018, gender: 'Male' }, false),
      },
      {
        name: 'class8_nongovt_with_address_before_2000',
        make: gen(
          { ownership: 'Non-Government' },
          { kind: 'class', exam: '8', passing_year: 1995, gender: 'Male' },
          true,
        ),
      },
      {
        name: 'class8_roll_registration_after_2020',
        make: gen(
          {},
          {
            kind: 'class',
            exam: '8',
            passing_year: 2023,
            roll: '123456',
            registration_no: '1234567890',
            gender: 'Male',
          },
          true,
        ),
      },
    ];
  };

  // ---- registration forms (puppeteer) ----
  const registrationSamples = async () => {
    const svcMod = await import('@/modules/registration/registrationForm.service.js');
    const forms = [
      ['class6', svcMod.class6FormConfig],
      ['class8', svcMod.class8FormConfig],
      ['junior_scholarship', svcMod.juniorScholarshipFormConfig],
      ['class9', svcMod.class9FormConfig],
    ] as const;
    return forms.map(([name, cfg]) => ({
      name,
      make: () =>
        inSchool(async () => {
          const year = cfg.yearKind === 'int' ? 2026 : '2026';
          const registration = sampleRow({
            ...fixedPerson,
            id: 'sample-registration-id',
            school_id: SCHOOL_ID,
            status: 'Pending',
            [cfg.yearField]: year,
            [cfg.photoField]: null,
            pdf_path: null,
            pdf_settings_snapshot: null,
          });
          const settings = {
            [cfg.settingsYearField]: year,
            instruction_for_a: 'Sample instruction for section A.',
            instruction_for_b: 'Sample instruction for section B.',
            attachment_instruction: 'Sample attachment instruction.',
            notice: 'Sample notice',
          };
          prisma[cfg.studentModel] = { findFirst: async () => registration };
          prisma[cfg.settingsModel] = { findFirst: async () => settings };
          prisma.school = { findUnique: async () => schoolRow };
          const service = svcMod.createRegistrationFormService(cfg);
          const { pdfBuffer } = await service.downloadRegistrationPDF(
            'sample-registration-id',
            'live',
          );
          if (!pdfBuffer) throw new Error(`${name}: no PDF generated`);
          return pdfBuffer;
        }),
    }));
  };

  // ---- admission form (puppeteer, Chrome path from PUPPETEER_EXECUTABLE_PATH / Windows default) ----
  const admissionSamples = async () => {
    const { generateAdmissionPDF } = await import('@/modules/admission/form/admission-form-pdf.js');
    prisma.admission = {
      findFirst: async () => ({
        instruction: 'Sample instruction',
        ingikar: 'Sample declaration',
        attachment_instruction_class6: 'Sample attachments',
        attachment_instruction_class9: 'Sample attachments',
      }),
    };
    const admission = (cls: string, list: string) =>
      sampleRow({
        ...fixedPerson,
        id: 1,
        admission_class: cls,
        admission_year: 2026,
        list_type: list,
        qouta: '(GEN)',
        serial_no: 17,
        registration_no: 'R-0017',
        roll_in_prev_school: 5,
        section_in_prev_school: 'A',
        prev_school_passing_year: 2025,
      });
    return [
      {
        name: 'class6_selected',
        make: async () => (await generateAdmissionPDF(admission('6', 'Selected'))) as Buffer,
      },
      {
        name: 'class9_waiting',
        make: async () => (await generateAdmissionPDF(admission('9', 'Waiting'))) as Buffer,
      },
    ];
  };

  // ---- attendance sheet (pdfkit) ----
  const attendanceSamples = async () => {
    const { AttendanceSheetService } =
      await import('@/modules/attendence/attendence-sheet.service.js');
    return [
      {
        name: 'monthly_class7',
        make: () =>
          inSchool(async () => {
            prisma.school = {
              findUnique: async () => ({ customDomain: 'www.example.edu.bd', eiin: '123456' }),
            };
            prisma.levels = {
              findFirst: async () => ({ teacher_id: 1, teacher: { name: 'Rahim Uddin' } }),
            };
            prisma.student_enrollments = {
              findMany: async () =>
                Array.from({ length: 40 }, (_, i) => ({
                  student_id: i + 1,
                  roll: i + 1,
                  student: { name: `Student Number ${i + 1}`, available: true },
                })),
            };
            prisma.attendance_sheets = { findFirst: async () => null };
            prisma.attendence = {
              findMany: async () =>
                Array.from({ length: 40 }, (_, i) => i + 1).flatMap((id) =>
                  Array.from({ length: 22 }, (_, d) => ({
                    student_id: id,
                    date: `2026-03-${String(d + 1).padStart(2, '0')}`,
                    status: (id + d) % 7 === 0 ? 'absent' : 'present',
                  })),
                ),
            };
            return (await AttendanceSheetService.renderPdf(2026, 3, 7, 'A')).buffer;
          }),
      },
    ];
  };

  // ---- student form (pdfkit) ----
  const studentSamples = async () => {
    const { generatePDF } = await import('@/modules/student/student.service.js');
    return [
      {
        name: 'student_form',
        make: async () =>
          (
            await generatePDF({
              school_name: schoolRow.name,
              school_location: 'Panchbibi, Joypurhat',
              school_website: 'www.example.edu.bd',
              name: 'Rahim Uddin',
              father_name: 'Karim Uddin',
              mother_name: 'Rahima Begum',
              roll: 12,
              class: 7,
              section: 'A',
              session: 2026,
              dob: '2013-05-14',
              student_id: '260712',
              id: 1,
              imageKey: null,
              address: [
                { title: 'Village', value: 'Main Road' },
                { title: 'Upazila', value: 'Panchbibi' },
              ],
            })
          ).pdfBuffer,
      },
    ];
  };

  // A group whose imports/setup fail still shows up as one failing sample instead of hiding the rest.
  const group = async (name: string, build: () => Promise<PdfSampleGroup['samples']>) => {
    try {
      return { group: name, samples: await build() };
    } catch (e) {
      return {
        group: name,
        samples: [
          {
            name: 'setup',
            make: async (): Promise<Buffer> => {
              throw e;
            },
          },
        ],
      };
    }
  };
  return [
    await group('fee', feeSamples),
    await group('testimonial', certificateSamples),
    await group('registration', registrationSamples),
    await group('admission', admissionSamples),
    await group('attendance', attendanceSamples),
    await group('student', studentSamples),
  ];
}
