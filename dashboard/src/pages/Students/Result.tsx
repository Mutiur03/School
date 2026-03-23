import { useState } from "react";
import { useAuth } from "@/context/useAuth";
import { useExams } from "@/queries/exam.queries";
import { useStudentMarks } from "@/queries/marks.queries";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PageHeader, SectionCard } from "@/components";
import MarkSheetDisplay from "./MarkSheetDisplay";
import { motion, AnimatePresence } from "framer-motion";
import Loading from "@/components/Loading";
import { Search } from "lucide-react";

function Result() {
  const { user } = useAuth();
  const student = user?.role === "student" ? user : null;
  
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [examName, setExamName] = useState("");
  const [show, setShow] = useState(false);

  const { data: exams = [], isLoading: examsLoading } = useExams();
  
  const availableExams = exams.filter(e => 
    e.exam_year === selectedYear && e.visible === true
  );

  const { data: marks, isLoading: marksLoading, refetch } = useStudentMarks(
    student?.id,
    selectedYear,
    examName
  );

  if (!student) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShow(true);
    refetch();
  };

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader 
        title="My Results" 
        description="View and download your academic transcripts."
      />

      <SectionCard
        title="Result Filters"
        icon={<Search className="w-5 h-5" />}
      >
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end"
        >
          <div className="space-y-2">
            <Label htmlFor="year" className="text-sm font-medium">
              Academic Year
            </Label>
            <select
              id="year"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={selectedYear.toString()}
              onChange={(e) => {
                setSelectedYear(Number(e.target.value));
                setExamName("");
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
            <Label htmlFor="exam" className="text-sm font-medium">
              Exam Name
            </Label>
            <select
              id="exam"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={examName}
              onChange={(e) => {
                setExamName(e.target.value);
                setShow(false);
              }}
              disabled={examsLoading || availableExams.length === 0}
            >
              <option value="" disabled>
                {examsLoading ? "Loading exams..." : "Select exam"}
              </option>
              {Array.from(new Set(availableExams.map((e) => e.exam_name))).map((exam) => (
                <option key={exam} value={exam}>
                  {exam}
                </option>
              ))}
            </select>
          </div>

          <Button
            type="submit"
            className="w-full sm:w-auto px-8 gap-2"
            disabled={marksLoading || !examName}
          >
            <Search className="h-4 w-4" />
            {marksLoading ? "Fetching..." : "View Transcript"}
          </Button>
        </form>
      </SectionCard>

      <AnimatePresence mode="wait">
        {show && marksLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <Loading />
            <p className="mt-4 text-muted-foreground animate-pulse">Fetching your marks...</p>
          </motion.div>
        )}

        {show && !marksLoading && marks && (
          <motion.div
            key={`${selectedYear}-${examName}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
          >
            <MarkSheetDisplay 
              studentId={student.id} 
              year={selectedYear} 
              marks={marks} 
              examName={examName}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Result;
