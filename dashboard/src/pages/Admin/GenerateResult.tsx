import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Download,
  Search,
  Users,
  Calendar,
  GraduationCap,
  Layers,
  FileSpreadsheet,
  RefreshCw,
  Trophy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PageHeader, SectionCard } from '@/components';
import Loading from '@/components/Loading';
import { motion } from 'framer-motion';
import { useStudents } from '@/queries/students.queries';
import { useUpdatePromotionStatus, useGeneratePromotionRoll } from '@/queries/promotion.queries';
import { openBlobInNewTab } from '@school/common-ui/blob';

const GenerateResult = () => {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [classSection, setClassSection] = useState<string>('');
  const [group, setGroup] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');

  // React Queries & Mutations
  const {
    data: studentsResponse,
    isLoading: studentsLoading,
    error: studentsError,
  } = useStudents({
    year,
    page: 1,
    limit: 1000, // Fetch all for result generation
    level: selectedClass ? Number(selectedClass) : undefined,
    section: classSection || undefined,
  });

  const { mutate: updateStatus, isPending: isUpdatingStatus } = useUpdatePromotionStatus();
  const { mutate: generateRoll, isPending: isGeneratingRoll } = useGeneratePromotionRoll();

  const students = studentsResponse?.data || [];
  const loading = studentsLoading || isUpdatingStatus || isGeneratingRoll;

  useEffect(() => {
    const storedYear = sessionStorage.getItem('generateResultYear');
    const storedClass = sessionStorage.getItem('generateResultClass');
    const storedSection = sessionStorage.getItem('generateResultSection');
    const storedGroup = sessionStorage.getItem('generateResultGroup');

    if (storedYear) setYear(Number(storedYear));
    if (storedClass) setSelectedClass(storedClass);
    if (storedSection) setClassSection(storedSection);
    if (storedGroup) setGroup(storedGroup);
  }, []);

  const handleYearChange = (value: string) => {
    setYear(Number(value));
    sessionStorage.setItem('generateResultYear', value);
  };

  const handleClassChange = (value: string) => {
    setSelectedClass(value);
    setGroup('');
    setClassSection('');
    sessionStorage.setItem('generateResultClass', value);
  };

  const handleSectionChange = (value: string) => {
    setClassSection(value);
    sessionStorage.setItem('generateResultSection', value);
  };

  const handleGroupChange = (value: string) => {
    setGroup(value);
    sessionStorage.setItem('generateResultGroup', value);
  };

  const handleGenerateResult = () => {
    updateStatus(year);
  };

  const handleGenerateRoll = () => {
    if (
      !confirm(
        'Are you sure you want to generate roll? This action will overwrite existing roll numbers and cannot be undone.',
      )
    )
      return;
    generateRoll(year);
  };

  const filteredStudents = useMemo(() => {
    return students
      .filter((s) => !group || s.group === group)
      .sort(
        (a, b) =>
          (a.section || '').localeCompare(b.section || '') ||
          (Number(a.roll) || 0) - (Number(b.roll) || 0),
      );
  }, [students, group]);

  const downloadSessionMarksheet = async (studentId: number) => {
    try {
      const response = await axios.get(`/api/marks/${studentId}/${year}/download`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      openBlobInNewTab(blob);
    } catch {
      toast.error('Failed to download session marksheet');
    }
  };

  const downloadAllMarksheetPDF = async () => {
    try {
      const response = await axios.get(`/api/marks/all/${year}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      openBlobInNewTab(blob);
    } catch {
      toast.error('Failed to download all marksheets');
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 overflow-hidden p-4 sm:p-6">
      <PageHeader
        title="Generate & Manage Results"
        description="Automate merit ranking, generate promotional status, and download student marksheets."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title="Merit & Progress"
          icon={<Trophy className="h-5 w-5 text-amber-500" />}
          description="Calculate merit positions and generate promotional status (Pass/Fail) for the current year."
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                <Calendar className="h-3 w-3" /> Select Academic Year
              </Label>
              <select
                value={year}
                onChange={(e) => handleYearChange(e.target.value)}
                className="border-input bg-background ring-offset-background focus:ring-primary flex h-10 w-full rounded-md border px-3 py-2 text-sm transition-[color,background-color,border-color,box-shadow,opacity,transform] focus:ring-2 focus:outline-none dark:bg-zinc-900"
              >
                {Array.from({ length: 5 }, (_, i) => (
                  <option key={i} value={currentYear - i}>
                    {currentYear - i}
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={handleGenerateResult}
              disabled={isUpdatingStatus}
              className="h-11 w-full font-bold shadow-sm transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:shadow-md"
            >
              {isUpdatingStatus ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Generate Pass/Fail Status
            </Button>
            <p className="text-muted-foreground px-4 text-center text-[11px] italic">
              Tip: Generate status first, then refine manually in "Customize Result" if needed.
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="Annual Promotion"
          icon={<Users className="h-5 w-5 text-indigo-500" />}
          description="Finalize transitions by generating new roll numbers for the next academic year."
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                <Calendar className="h-3 w-3" /> Select Promotion Year
              </Label>
              <select
                value={year}
                onChange={(e) => handleYearChange(e.target.value)}
                className="border-input bg-background ring-offset-background focus:ring-primary flex h-10 w-full rounded-md border px-3 py-2 text-sm transition-[color,background-color,border-color,box-shadow,opacity,transform] focus:ring-2 focus:outline-none dark:bg-zinc-900"
              >
                {Array.from({ length: 5 }, (_, i) => (
                  <option key={i} value={currentYear - i}>
                    {currentYear - i}
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={handleGenerateRoll}
              disabled={isGeneratingRoll}
              variant="secondary"
              className="border-border h-11 w-full border font-bold shadow-sm transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:shadow-md"
            >
              {isGeneratingRoll ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Generate Next Year Rolls
            </Button>
            <p className="text-destructive/80 px-4 text-center text-[11px] font-medium">
              Warning: This will overwrite existing roll numbers for the next year.
            </p>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Data Filters" icon={<Search className="h-5 w-5" />}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
              <Calendar className="h-3 w-3" /> Year
            </Label>
            <select
              value={year}
              onChange={(e) => handleYearChange(e.target.value)}
              className="border-input bg-background ring-offset-background focus:ring-primary flex h-10 w-full rounded-md border px-3 py-2 text-sm transition-[color,background-color,border-color,box-shadow,opacity,transform] focus:ring-2 focus:outline-none dark:bg-zinc-900"
            >
              {Array.from({ length: 5 }, (_, i) => (
                <option key={i} value={currentYear - i}>
                  {currentYear - i}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
              <GraduationCap className="h-3 w-3" /> Class
            </Label>
            <select
              value={selectedClass}
              onChange={(e) => handleClassChange(e.target.value)}
              className="border-input bg-background ring-offset-background focus:ring-primary flex h-10 w-full rounded-md border px-3 py-2 text-sm transition-[color,background-color,border-color,box-shadow,opacity,transform] focus:ring-2 focus:outline-none dark:bg-zinc-900"
            >
              <option value="">All Classes</option>
              {[6, 7, 8, 9, 10].map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
              <Users className="h-3 w-3" /> Section
            </Label>
            <select
              value={classSection}
              onChange={(e) => handleSectionChange(e.target.value)}
              className="border-input bg-background ring-offset-background focus:ring-primary flex h-10 w-full rounded-md border px-3 py-2 text-sm transition-[color,background-color,border-color,box-shadow,opacity,transform] focus:ring-2 focus:outline-none disabled:opacity-50 dark:bg-zinc-900"
              disabled={!selectedClass}
            >
              <option value="">All Sections</option>
              {['A', 'B', 'C', 'D'].map((section) => (
                <option key={section} value={section}>
                  {section}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
              <Layers className="h-3 w-3" /> Group
            </Label>
            <select
              value={group}
              onChange={(e) => handleGroupChange(e.target.value)}
              className="border-input bg-background ring-offset-background focus:ring-primary flex h-10 w-full rounded-md border px-3 py-2 text-sm transition-[color,background-color,border-color,box-shadow,opacity,transform] focus:ring-2 focus:outline-none disabled:opacity-50 dark:bg-zinc-900"
              disabled={Number(selectedClass) < 9}
            >
              <option value="">All Groups</option>
              {['Science', 'Humanities', 'Commerce'].map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        noPadding
        title="Student Merit List"
        icon={<FileSpreadsheet className="text-primary h-5 w-5" />}
        description={
          studentsError ? 'Failed to load students' : `Showing ${filteredStudents.length} records`
        }
        headerAction={
          filteredStudents.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={downloadAllMarksheetPDF}
              className="border-primary/20 bg-primary/5 text-primary hover:bg-primary h-8 w-full gap-1.5 px-3 font-medium shadow-none transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:text-white sm:w-auto"
            >
              <Download className="h-3.5 w-3.5" />
              Download All PDFs
            </Button>
          )
        }
      >
        {/* Mobile cards */}
        <div className="lg:hidden">
          {loading && students.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <Loading />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-muted-foreground px-4 py-16 text-center italic">
              {studentsError
                ? 'An error occurred while fetching students.'
                : 'No students matching your filters found.'}
            </div>
          ) : (
            <ul className="divide-border divide-y">
              {filteredStudents.map((student) => (
                <li key={student.id} className="space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    <span
                      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        student.final_merit === 1
                          ? 'bg-amber-500 text-white'
                          : student.final_merit === 2
                            ? 'bg-zinc-400 text-white'
                            : student.final_merit === 3
                              ? 'bg-amber-700 text-white'
                              : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {student.final_merit || '-'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate font-semibold uppercase">
                        {student.name || 'N/A'}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                        Roll {student.roll || 'N/A'} · Sec {student.section || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <div className="bg-primary/5 min-w-0 rounded-md px-2 py-1.5">
                      <dt className="text-muted-foreground">Next Roll</dt>
                      <dd className="text-primary font-semibold tabular-nums">
                        {student.next_year_roll || 'N/A'}
                      </dd>
                    </div>
                    <div className="bg-primary/5 min-w-0 rounded-md px-2 py-1.5">
                      <dt className="text-muted-foreground">Next Sec</dt>
                      <dd className="text-primary font-semibold">
                        {student.next_year_section || 'N/A'}
                      </dd>
                    </div>
                  </dl>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-primary/20 bg-primary/5 text-primary hover:bg-primary h-8 w-full gap-1.5 px-3 font-medium shadow-none transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:text-white"
                    onClick={() => downloadSessionMarksheet(student.id)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Session PDF
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Desktop table — sticky via Tailwind left-* only (no inline left) */}
        <div className="hidden min-h-[300px] max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] lg:block">
          <table className="w-max min-w-full border-separate border-spacing-0 text-left text-sm">
            <thead className="sticky top-0 z-20">
              <tr className="bg-muted/50 border-border">
                <th className="bg-muted/50 sticky left-0 z-30 w-14 min-w-14 border-r border-b px-3 py-4 text-center font-bold text-gray-900 italic dark:text-gray-100">
                  Merit
                </th>
                <th className="bg-muted/50 sticky left-14 z-30 min-w-40 border-r border-b px-3 py-4 font-bold text-gray-900 italic shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)] dark:text-gray-100">
                  Student Name
                </th>
                <th className="w-20 border-b px-6 py-4 text-center font-bold text-gray-900 italic dark:text-gray-100">
                  Roll
                </th>
                <th className="w-24 border-b px-6 py-4 text-center font-bold text-gray-900 italic dark:text-gray-100">
                  Section
                </th>
                <th className="bg-primary/5 w-24 border-b px-6 py-4 text-center font-bold text-gray-900 italic dark:text-gray-100">
                  Next Roll
                </th>
                <th className="bg-primary/5 w-28 border-b px-6 py-4 text-center font-bold text-gray-900 italic dark:text-gray-100">
                  Next Sec
                </th>
                <th className="w-32 border-b px-6 py-4 text-center font-bold text-gray-900 italic dark:text-gray-100">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <Loading />
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-muted-foreground py-20 text-center italic">
                    {studentsError
                      ? 'An error occurred while fetching students.'
                      : 'No students matching your filters found.'}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, idx) => (
                  <motion.tr
                    key={student.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(idx * 0.03, 0.5) }}
                    className="hover:bg-muted/30 group transition-[color,background-color,border-color,box-shadow,opacity,transform]"
                  >
                    <td className="bg-card border-border/50 sticky left-0 z-10 w-14 min-w-14 border-r px-3 py-4 text-center">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${
                          student.final_merit === 1
                            ? 'bg-amber-500 text-white'
                            : student.final_merit === 2
                              ? 'bg-zinc-400 text-white'
                              : student.final_merit === 3
                                ? 'bg-amber-700 text-white'
                                : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {student.final_merit || '-'}
                      </span>
                    </td>
                    <td className="group-hover:text-primary bg-card border-border/50 sticky left-14 z-10 min-w-40 border-r px-3 py-4 font-bold text-gray-800 uppercase shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)] transition-colors dark:text-gray-200">
                      {student.name || 'N/A'}
                    </td>
                    <td className="border-border/50 border-r px-6 py-4 text-center tabular-nums">
                      {student.roll || 'N/A'}
                    </td>
                    <td className="border-border/50 border-r px-6 py-4 text-center font-medium">
                      {student.section || 'N/A'}
                    </td>
                    <td className="text-primary bg-primary/5 border-border/50 border-r px-6 py-4 text-center font-bold tabular-nums">
                      {student.next_year_roll || 'N/A'}
                    </td>
                    <td className="text-primary bg-primary/5 border-border/50 border-r px-6 py-4 text-center font-bold">
                      {student.next_year_section || 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-primary/20 bg-primary/5 text-primary hover:bg-primary h-8 gap-1.5 px-3 font-medium shadow-none transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:text-white"
                          onClick={() => downloadSessionMarksheet(student.id)}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Session PDF
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
};

export default GenerateResult;
