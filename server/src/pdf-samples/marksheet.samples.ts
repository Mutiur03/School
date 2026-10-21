// Sample marksheet PDFs: per-exam (junior TOTAL layout, class 10 CQ/MCQ/PRAC layout), session
// (classes 6-9 two exams, class 10 year-end only) and the class summary. No DB: fake data into the
// real draw code. Import this only after the spec has mocked `@/config/prisma.js` and the renderer.
import type { PdfSampleGroup } from './types.js';

const meta = (ownership: string | null) => ({
  ownership,
  name: 'Panchbibi Model High School',
  location: 'Panchbibi, Joypurhat',
  eiin: '123456',
  website: 'www.example.edu.bd',
  phone: '01700000000',
  logoKey: null,
  logoEtag: null,
});
const sigs = {
  teacherName: 'Rahim Uddin',
  teacherPhone: '01711111111',
  headName: 'Karim Hossain',
  headRole: 'Headmaster',
  schoolPhone: '01700000000',
};

const sub = (id: number, name: string, over: Record<string, unknown> = {}) => ({
  id,
  name,
  class: 7,
  group: null,
  priority: id,
  parent_id: null,
  subject_type: 'single',
  assessment_type: 'exam',
  marking_scheme: 'TOTAL',
  full_mark: 100,
  pass_mark: 33,
  cq_mark: 0,
  mcq_mark: 0,
  practical_mark: 0,
  cq_pass_mark: 0,
  mcq_pass_mark: 0,
  practical_pass_mark: 0,
  parent: null,
  ...over,
});
const paper = (id: number, name: string, cls: number) =>
  sub(id, name, {
    class: cls,
    subject_type: 'paper',
    parent_id: 20,
    parent: { name: 'English' },
    full_mark: 50,
    pass_mark: 17,
  });
const none = { marks: null, cq: null, mcq: null, practical: null };

/** Junior subjects: English is a main subject split into two papers, Religion is continuous. */
const juniorSubjects = (cls: number) => [
  sub(1, 'Bangla', { class: cls }),
  paper(21, 'English 1st Paper', cls),
  paper(22, 'English 2nd Paper', cls),
  sub(3, 'Mathematics', { class: cls }),
  sub(4, 'Science', { class: cls }),
  sub(5, 'Bangladesh & Global Studies', { class: cls }),
  sub(6, 'Religion', { class: cls, assessment_type: 'continuous', full_mark: 50, pass_mark: 0 }),
];

const breakdown = (id: number, name: string, extra: Record<string, unknown> = {}) =>
  sub(id, name, {
    class: 10,
    group: 'Science',
    marking_scheme: 'BREAKDOWN',
    cq_mark: 60,
    mcq_mark: 25,
    practical_mark: 15,
    cq_pass_mark: 20,
    mcq_pass_mark: 8,
    practical_pass_mark: 5,
    ...extra,
  });
const class10Subjects = () => [
  breakdown(1, 'Bangla', {
    cq_mark: 70,
    mcq_mark: 30,
    practical_mark: 0,
    cq_pass_mark: 23,
    mcq_pass_mark: 10,
    practical_pass_mark: 0,
  }),
  breakdown(2, 'Physics'),
  breakdown(3, 'Chemistry'),
  breakdown(4, 'Biology'),
  breakdown(5, 'Higher Mathematics'),
];
const class10Marks = [
  [55, 22, 0],
  [48, 20, 13],
  [50, 18, 12],
  [52, 21, 14],
  [40, 15, 11],
];

const student = (cls: number, over: Record<string, unknown> = {}) => ({
  name: 'Md. Abdul Karim',
  class: cls,
  section: 'A',
  roll: 5,
  year: 2026,
  exam: 'Half Yearly Exam',
  classHighestTotal: 540,
  classHighestGrandTotal: 640,
  fourth_subject_id: null,
  applyBonus: false,
  result_date: '2026-07-10',
  return_date: '2026-07-20',
  ...over,
});

export async function marksheetSamples(): Promise<PdfSampleGroup[]> {
  const draw = await import('@/nest/modules/marksheets/pdf/marksheet-draw.js');
  const { aggregatePaperMarks } = await import('@/nest/modules/marksheets/pdf/grading.js');
  const { ClassSummaryService } =
    await import('@/nest/modules/marksheets/pdf/class-summary.service.js');
  const { computeStudentResult, rankStudents } =
    await import('@/nest/modules/promotion/v1/session-result.js');

  const table = (subjects: any[], marks: (number | null)[], extra: any[] = []) =>
    aggregatePaperMarks(
      subjects.map((s, i) => ({
        subject: s,
        subject_id: s.id,
        exam_id: 1,
        marks: marks[i],
        cq_marks: null,
        mcq_marks: null,
        practical_marks: null,
        highest_mark: Math.min(100, (marks[i] ?? 0) + 7),
        ...(extra[i] ?? {}),
      })),
    );
  const exam = (
    name: string,
    cls: number,
    rows: any[],
    over: Record<string, unknown>,
    ownership: string,
  ) => ({
    name,
    make: () =>
      draw.renderStudentReportPDF(student(cls, over), rows, sigs, meta(ownership) as any, null),
  });

  const junior = (cls: number) => juniorSubjects(cls);
  const class10 = class10Subjects();
  const class10Table = table(
    class10,
    class10Marks.map(([cq, mcq, pr]) => cq + mcq + pr),
    class10Marks.map(([cq, mcq, pr]) => ({ cq_marks: cq, mcq_marks: mcq, practical_marks: pr })),
  );

  // Session results: class 8 (two exams) with one passing and one failing student.
  const mk = (subject_id: number, exam_id: number, marks: number) => ({
    subject_id,
    exam_id,
    marks,
    cq_marks: null,
    mcq_marks: null,
    practical_marks: null,
  });
  const ids8 = junior(8).map((s) => s.id);
  const result8 = (enrollmentId: number, roll: number, prev: number[], ye: number[]) =>
    computeStudentResult({
      enrollmentId,
      classLevel: 8,
      group: null,
      section: 'A',
      roll,
      fourthSubjectId: null,
      subjects: junior(8) as any,
      marks: ids8.flatMap((id, i) => [mk(id, 1, prev[i]), mk(id, 2, ye[i])]) as any,
      previousExamId: 1,
      yearEndExamId: 2,
    });
  const results8 = [
    result8(1, 1, [70, 30, 28, 80, 60, 60, 40], [75, 35, 31, 85, 72, 66, 44]),
    result8(2, 2, [40, 20, 15, 30, 50, 50, 30], [35, 25, 10, 20, 44, 40, 20]),
  ];
  const pos8 = rankStudents(results8);
  const page = (r: any, studentName: string, position: number, previous: string | null) => ({
    result: {
      ...r,
      position,
      studentId: r.enrollmentId,
      studentName,
      previousExamId: previous ? 1 : null,
      yearEndExamId: 2,
      held: false,
      manual: false,
    },
    previousExamName: previous,
    yearEndExamName: 'Annual Exam',
    resultDate: '2026-12-20',
    returnDate: '2026-12-30',
  });
  const result10 = computeStudentResult({
    enrollmentId: 9,
    classLevel: 10,
    group: 'Science',
    section: 'A',
    roll: 1,
    fourthSubjectId: null,
    subjects: class10 as any,
    marks: class10.map((s, i) => ({
      subject_id: s.id,
      exam_id: 2,
      marks: class10Marks[i].reduce((a, b) => a + b, 0),
      cq_marks: class10Marks[i][0],
      mcq_marks: class10Marks[i][1],
      practical_marks: class10Marks[i][2],
    })) as any,
    previousExamId: null,
    yearEndExamId: 2,
  });
  void none;

  const summarySubjects = junior(7);
  const summary = new ClassSummaryService(
    {
      school: { findUnique: async () => ({ name: 'Panchbibi Model High School' }) },
      student_enrollments: {
        findMany: async () =>
          Array.from({ length: 12 }, (_, i) => ({
            id: i + 1,
            roll: i + 1,
            section: i % 2 ? 'B' : 'A',
            group: null,
            fourth_subject_id: null,
            student: { id: i + 1, name: `Student Number ${i + 1}` },
            marks: summarySubjects.map((s, k) => ({
              subject_id: s.id,
              exam_id: 1,
              marks: Math.max(0, 85 - k * 4 - (i + 1)),
              subject: s,
              exam: { id: 1, exam_name: 'Half Yearly Exam' },
            })),
          })),
      },
    } as any,
    {
      loadMarksheetSubjects: async () => summarySubjects,
      shouldApplyFourthSubjectBonus: async () => false,
    } as any,
  );

  return [
    {
      group: 'marksheet',
      samples: [
        exam(
          'exam_class7_government',
          7,
          table(junior(7), [78, 40, 38, 85, 72, 66, 44]),
          {},
          'Government',
        ),
        exam(
          'exam_class8_with_fail_nongovt',
          8,
          table(junior(8), [55, 30, 28, 20, 64, 59, 40]),
          {},
          'Non-Government',
        ),
        exam(
          'exam_class10_breakdown_4th_subject',
          10,
          class10Table,
          { fourth_subject_id: 5, applyBonus: true },
          'Government',
        ),
        {
          name: 'session_class8_pass_and_fail',
          make: () =>
            draw.renderSessionMarksheetsPDF(
              2026,
              'v1',
              [
                page(results8[0], 'Md. Abdul Karim', pos8.get(1)!, 'Half Yearly Exam'),
                page(results8[1], 'Mst. Rina Akter', pos8.get(2)!, 'Half Yearly Exam'),
              ],
              async () => sigs,
              meta('Government') as any,
              null,
            ),
        },
        {
          name: 'session_class10_year_end_only',
          make: () =>
            draw.renderSessionMarksheetsPDF(
              2026,
              'v1',
              [page(result10, 'Md. Abdul Karim', 1, null)],
              async () => sigs,
              meta('Non-Government') as any,
              null,
            ),
        },
        {
          name: 'class_summary',
          make: async () =>
            (
              await summary.generateClassSummaryPDF(1, 7, 2026, 'Half Yearly Exam', {
                id: 1,
                role: 'admin',
              } as any)
            ).buffer,
        },
      ],
    },
  ];
}
