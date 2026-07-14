"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import toast from "react-hot-toast";
import { Download, Eye, LogOut, Loader2 } from "lucide-react";
import {
  downloadBlob,
  openBlobInNewTab,
  getFilenameFromContentDisposition,
} from "@school/common-ui/blob";
import {
  filterNumericInput,
  publicResultVerifySchema,
  type PublicResultVerifyData,
  type PublicResultVerifyInput,
} from "@school/shared-schemas";

interface ExamOption {
  exam_name: string;
  result_date: string | null;
}
interface SessionOption {
  year: number;
  exams: ExamOption[];
}
interface VerifyResponse {
  token: string;
  student: { id: number; name: string };
  sessions: SessionOption[];
}
interface ResultRow {
  subject: string;
  marks: number;
  full_mark: number | null;
}
interface ExamResult {
  student: {
    name: string;
    roll: number;
    class: number;
    section: string;
    year: number;
  };
  exam_name: string;
  result_date: string | null;
  rows: ResultRow[];
  total: number;
  total_full: number;
}

const SECTION_OPTIONS = [
  { label: "Select Section", value: "" },
  { label: "A", value: "A" },
  { label: "B", value: "B" },
];
const CLASS_OPTIONS = Array.from({ length: 5 }, (_, i) => i + 6);
const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => currentYear - i);

const DEFAULT_VALUES: PublicResultVerifyInput = {
  year: String(currentYear),
  class: "",
  section: "",
  roll: "",
  phone: "",
};

function errMsg(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    return (
      (error.response?.data as { message?: string })?.message ?? fallback
    );
  }
  return fallback;
}

export default function ResultClient() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PublicResultVerifyInput, unknown, PublicResultVerifyData>({
    resolver: zodResolver(publicResultVerifySchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onSubmit",
  });

  const [verified, setVerified] = useState<PublicResultVerifyData | null>(null);
  const [session, setSession] = useState<VerifyResponse | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedExam, setSelectedExam] = useState<string>("");

  const [result, setResult] = useState<ExamResult | null>(null);
  const [loadingResult, setLoadingResult] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const examsForYear = useMemo<ExamOption[]>(() => {
    if (!session || selectedYear == null) return [];
    return session.sessions.find((s) => s.year === selectedYear)?.exams ?? [];
  }, [session, selectedYear]);

  const authHeader = session
    ? { Authorization: `Bearer ${session.token}` }
    : undefined;

  async function onVerify(body: PublicResultVerifyData) {
    try {
      const { data } = await axios.post("/api/marks/public/verify", body);
      const payload = data.data as VerifyResponse;
      setVerified(body);
      setSession(payload);
      const firstYear = payload.sessions[0]?.year ?? null;
      const firstExam = payload.sessions[0]?.exams[0]?.exam_name ?? "";
      setSelectedYear(firstYear);
      setSelectedExam(firstExam);
      setResult(null);
      if (firstYear != null && firstExam) {
        await fetchResult(payload.token, firstYear, firstExam);
      }
    } catch (error) {
      toast.error(errMsg(error, "Could not verify student details"));
    }
  }

  async function fetchResult(token: string, yearNum: number, exam: string) {
    setLoadingResult(true);
    try {
      const { data } = await axios.get("/api/marks/public/result", {
        params: { year: yearNum, exam },
        headers: { Authorization: `Bearer ${token}` },
      });
      setResult(data.data as ExamResult);
    } catch (error) {
      setResult(null);
      toast.error(errMsg(error, "Could not load result"));
    } finally {
      setLoadingResult(false);
    }
  }

  function handleSelect(yearNum: number, exam: string) {
    setSelectedYear(yearNum);
    setSelectedExam(exam);
    if (session) fetchResult(session.token, yearNum, exam);
  }

  async function getPdf(): Promise<{ blob: Blob; filename: string } | null> {
    if (!session || selectedYear == null || !selectedExam) return null;
    const res = await axios.get("/api/marks/public/download", {
      params: { year: selectedYear, exam: selectedExam },
      headers: authHeader,
      responseType: "blob",
    });
    const filename =
      getFilenameFromContentDisposition(res.headers["content-disposition"]) ??
      `marksheet_${selectedExam}_${selectedYear}.pdf`;
    return { blob: res.data as Blob, filename };
  }

  async function handleView() {
    setViewing(true);
    try {
      const pdf = await getPdf();
      if (pdf) openBlobInNewTab(pdf.blob);
    } catch (error) {
      toast.error(errMsg(error, "Could not open marksheet"));
    } finally {
      setViewing(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const pdf = await getPdf();
      if (pdf) downloadBlob(pdf.blob, pdf.filename);
    } catch (error) {
      toast.error(errMsg(error, "Could not download marksheet"));
    } finally {
      setDownloading(false);
    }
  }

  function handleLogout() {
    setSession(null);
    setVerified(null);
    setSelectedYear(null);
    setSelectedExam("");
    setResult(null);
    reset(DEFAULT_VALUES);
  }

  // ---- Lookup screen ----
  if (!session) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2 text-gray-800">Check Result</h1>
        <p className="text-gray-600 mb-8">
          Enter session, class, section, roll, and a registered mobile number to
          view your result and download your marksheet.
        </p>
        <form
          onSubmit={handleSubmit(onVerify)}
          className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-5"
          noValidate
        >
          <div>
            <label
              htmlFor="year"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Session
            </label>
            <select
              id="year"
              {...register("year")}
              className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            {errors.year && (
              <p className="mt-1 text-xs text-red-600">{errors.year.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="klass"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Class
              </label>
              <select
                id="klass"
                {...register("class")}
                className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select</option>
                {CLASS_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {errors.class && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.class.message}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="section"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Section
              </label>
              <select
                id="section"
                {...register("section")}
                className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                {SECTION_OPTIONS.map((s) => (
                  <option key={s.value || "empty"} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              {errors.section && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.section.message}
                </p>
              )}
            </div>
          </div>
          <div>
            <label
              htmlFor="roll"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Roll
            </label>
            <input
              id="roll"
              inputMode="numeric"
              {...register("roll", {
                setValueAs: (v) => filterNumericInput(String(v ?? "")),
              })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. 12"
            />
            {errors.roll && (
              <p className="mt-1 text-xs text-red-600">{errors.roll.message}</p>
            )}
          </div>
          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Mobile Number
            </label>
            <input
              id="phone"
              inputMode="numeric"
              maxLength={11}
              {...register("phone", {
                setValueAs: (v) =>
                  filterNumericInput(String(v ?? "")).slice(0, 11),
              })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. 01712345678"
              autoComplete="tel"
            />
            {errors.phone && (
              <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Use the father&apos;s or mother&apos;s phone number on record.
            </p>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? "Verifying..." : "View Result"}
          </button>
        </form>
      </div>
    );
  }

  // ---- Result screen ----
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {session.student.name}
          </h1>
          {verified && (
            <p className="text-gray-500 text-sm">
              Class {verified.class}
              {verified.section} · Roll {verified.roll} · Session{" "}
              {verified.year}
            </p>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          <LogOut className="h-4 w-4" /> Exit
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {session.sessions.length > 1 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Year
            </label>
            <select
              value={selectedYear ?? ""}
              onChange={(e) => {
                const yearNum = Number(e.target.value);
                const firstExam =
                  session.sessions.find((s) => s.year === yearNum)?.exams[0]
                    ?.exam_name ?? "";
                handleSelect(yearNum, firstExam);
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
            >
              {session.sessions.map((s) => (
                <option key={s.year} value={s.year}>
                  {s.year}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className={session.sessions.length > 1 ? "" : "sm:col-span-2"}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Exam
          </label>
          <select
            value={selectedExam}
            onChange={(e) =>
              selectedYear != null && handleSelect(selectedYear, e.target.value)
            }
            className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
          >
            {examsForYear.map((ex) => (
              <option key={ex.exam_name} value={ex.exam_name}>
                {ex.exam_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {loadingResult ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading result...
          </div>
        ) : result ? (
          <>
            <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-gray-100 px-5 py-4 text-sm text-gray-600">
              <span>
                <span className="text-gray-400">Class:</span> {result.student.class}
              </span>
              <span>
                <span className="text-gray-400">Roll:</span> {result.student.roll}
              </span>
              <span>
                <span className="text-gray-400">Section:</span>{" "}
                {result.student.section}
              </span>
              <span>
                <span className="text-gray-400">Exam:</span> {result.exam_name}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-600">
                    <th className="px-5 py-2.5 font-medium">Subject</th>
                    <th className="px-5 py-2.5 font-medium text-right">Marks</th>
                    <th className="px-5 py-2.5 font-medium text-right">Full Marks</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={r.subject} className="border-t border-gray-100">
                      <td className="px-5 py-2.5 text-gray-800">{r.subject}</td>
                      <td className="px-5 py-2.5 text-right text-gray-800">
                        {r.marks}
                      </td>
                      <td className="px-5 py-2.5 text-right text-gray-500">
                        {r.full_mark ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50 font-semibold">
                    <td className="px-5 py-2.5 text-gray-800">Total</td>
                    <td className="px-5 py-2.5 text-right text-gray-800">
                      {result.total}
                    </td>
                    <td className="px-5 py-2.5 text-right text-gray-600">
                      {result.total_full}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="flex flex-wrap justify-center gap-3 border-t border-gray-100 px-5 py-4">
              <button
                onClick={handleView}
                disabled={viewing || downloading}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                {viewing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                View Marksheet
              </button>
              <button
                onClick={handleDownload}
                disabled={viewing || downloading}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download PDF
              </button>
            </div>
          </>
        ) : (
          <div className="py-16 text-center text-gray-500">
            No result to display.
          </div>
        )}
      </div>
    </div>
  );
}
