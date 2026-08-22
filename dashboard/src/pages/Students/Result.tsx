import { useMemo, useState } from 'react';
import { useAuth } from '@/context/useAuth';
import { useExams, type Exam } from '@/queries/exam.queries';
import { useStudentMarks } from '@/queries/marks.queries';
import { useStudentProfile } from '@/queries/students.queries';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PageHeader, SectionCard } from '@/components';
import MarkSheetDisplay from './MarkSheetDisplay';
import { motion, AnimatePresence } from 'framer-motion';
import Loading from '@/components/Loading';
import { Search, Calendar, GraduationCap, ClipboardList, Sparkles } from 'lucide-react';

function parseExamDate(value?: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value.split('T')[0]);
  return Number.isNaN(parsed) ? null : parsed;
}

function comparePublishedExams(a: Exam, b: Exam): number {
  const startA = parseExamDate(a.start_date);
  const startB = parseExamDate(b.start_date);
  if (startA !== null && startB !== null && startA !== startB) {
    return startA - startB;
  }
  if (startA !== null && startB === null) return -1;
  if (startA === null && startB !== null) return 1;

  const resultA = parseExamDate(a.result_date);
  const resultB = parseExamDate(b.result_date);
  if (resultA !== null && resultB !== null && resultA !== resultB) {
    return resultA - resultB;
  }
  if (resultA !== null && resultB === null) return -1;
  if (resultA === null && resultB !== null) return 1;

  return a.id - b.id;
}

function Result() {
  const { user } = useAuth();
  const student = user?.role === 'student' ? user : null;

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [examName, setExamName] = useState('');
  const [show, setShow] = useState(false);

  const { data: exams = [], isLoading: examsLoading } = useExams();
  const { data: profile } = useStudentProfile(selectedYear);

  const sortedPublishedExams = useMemo(() => {
    return exams
      .filter((exam) => exam.exam_year === selectedYear && exam.visible === true)
      .sort(comparePublishedExams);
  }, [exams, selectedYear]);

  const examOptions = useMemo(
    () => sortedPublishedExams.map((exam) => exam.exam_name),
    [sortedPublishedExams],
  );

  const isSelectedExamPublished = useMemo(
    () => examName !== '' && sortedPublishedExams.some((exam) => exam.exam_name === examName),
    [examName, sortedPublishedExams],
  );

  const {
    data: marks,
    isLoading: marksLoading,
    refetch,
    isFetched,
  } = useStudentMarks(student?.id, selectedYear, examName, show && isSelectedExamPublished);

  if (!student) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!examName || !isSelectedExamPublished) return;
    setShow(true);
    refetch();
  };

  const handleQuickSelectExam = (name: string) => {
    if (!sortedPublishedExams.some((exam) => exam.exam_name === name)) return;
    setExamName(name);
    setShow(true);
    refetch();
  };

  const yearOptions = Array.from({ length: 5 }, (_, index) => currentYear - index);
  const noPublishedExams = !examsLoading && examOptions.length === 0;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="My results"
        description="Published exam marks for your session. Download the official marksheet PDF when ready."
      />

      <section className="border-border bg-muted/30 rounded-2xl border p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="bg-primary/10 text-primary shrink-0 rounded-xl p-3">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-primary text-sm font-medium">Academic record</p>
            <h2 className="text-lg font-semibold tracking-tight">{student.name}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {profile ? (
                <>
                  <Badge variant="secondary">Class {profile.class}</Badge>
                  <Badge variant="secondary">Section {profile.section}</Badge>
                  <Badge variant="secondary">Roll {profile.roll}</Badge>
                </>
              ) : (
                <Badge variant="outline">Login ID {student.login_id}</Badge>
              )}
              <Badge variant="outline">Session {selectedYear}</Badge>
            </div>
          </div>
        </div>
      </section>

      <SectionCard
        title="Choose an exam"
        icon={<Search className="text-primary h-5 w-5" />}
        description="Only published results appear here."
      >
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 items-end gap-4 md:grid-cols-[1fr_1fr_auto] md:gap-5"
        >
          <div className="space-y-2">
            <Label htmlFor="year" className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="text-muted-foreground h-4 w-4" />
              Academic year
            </Label>
            <select
              id="year"
              className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              value={selectedYear.toString()}
              onChange={(event) => {
                setSelectedYear(Number(event.target.value));
                setExamName('');
                setShow(false);
              }}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year.toString()}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="exam" className="flex items-center gap-2 text-sm font-medium">
              <ClipboardList className="text-muted-foreground h-4 w-4" />
              Exam
            </Label>
            <select
              id="exam"
              className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              value={examName}
              onChange={(event) => {
                setExamName(event.target.value);
                setShow(false);
              }}
              disabled={examsLoading || noPublishedExams}
            >
              <option value="" disabled>
                {examsLoading ? 'Loading exams…' : 'Select exam'}
              </option>
              {examOptions.map((exam) => (
                <option key={exam} value={exam}>
                  {exam}
                </option>
              ))}
            </select>
          </div>

          <Button
            type="submit"
            className="w-full gap-2 px-6 md:w-auto"
            disabled={marksLoading || !examName || noPublishedExams}
          >
            <Search className="h-4 w-4" />
            {marksLoading ? 'Loading…' : 'View marks'}
          </Button>
        </form>

        {noPublishedExams ? (
          <div className="border-border bg-muted/30 mt-5 rounded-lg border border-dashed px-4 py-5 text-center">
            <p className="text-sm font-medium">No published results for {selectedYear}</p>
            <p className="text-muted-foreground mt-1 text-sm">
              When the school publishes exam results, they will show up here.
            </p>
          </div>
        ) : sortedPublishedExams.length > 0 ? (
          <div className="mt-5">
            <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
              <Sparkles className="h-3.5 w-3.5" />
              Quick open
            </p>
            <div className="flex flex-wrap gap-2">
              {sortedPublishedExams.map((exam) => (
                <button
                  key={exam.id}
                  type="button"
                  onClick={() => handleQuickSelectExam(exam.exam_name)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    examName === exam.exam_name && show
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/40 hover:bg-muted/50'
                  }`}
                >
                  {exam.exam_name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </SectionCard>

      <AnimatePresence mode="wait">
        {show && !isSelectedExamPublished && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="border-border bg-muted/30 rounded-xl border border-dashed px-6 py-12 text-center"
          >
            <p className="font-medium">This result is not published yet</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Marks will appear here after the school publishes this exam result.
            </p>
          </motion.div>
        )}

        {show && isSelectedExamPublished && marksLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="border-border bg-card flex flex-col items-center justify-center rounded-xl border py-16"
          >
            <Loading />
            <p className="text-muted-foreground mt-4 text-sm">Loading your marks…</p>
          </motion.div>
        )}

        {show && isSelectedExamPublished && !marksLoading && isFetched && (
          <motion.div
            key={`${selectedYear}-${examName}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
          >
            <MarkSheetDisplay
              studentId={student.id}
              year={selectedYear}
              marks={marks ?? []}
              examName={examName}
              roll={profile?.roll}
              class={profile?.class}
              studentName={student.name}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Result;
