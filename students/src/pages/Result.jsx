/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from "react";
import { useAuth } from "../context/appContext";
import axios from "axios";
import { toast } from "react-hot-toast";
import { Button } from "../components/ui/button";
import MarksheetPage from "./MarkSheetDownload";
import { motion, AnimatePresence } from "framer-motion";

function Result() {
  const { student } = useAuth();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [examName, setExamName] = useState("");
  const [examList, setExamList] = useState([]);
  const [show, setShow] = useState(false);
  const [marks, setMarks] = useState([]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const res = await axios.get("/api/exams/getExams");
        const exams = res.data?.data || [];
        const currentYearExams = exams
          .filter((e) => e.exam_year === selectedYear)
          .filter((e) => e.visible === true);
        setExamList(currentYearExams.map((e) => e.exam_name));
      } catch (err) {
        console.error("Initial data error:", err);
        toast.error("Failed to load exams");
      }
    };

    fetchInitialData();
  }, [selectedYear]);

  if (!student) return null;

  const showMarksheet = async (e) => {
    e.preventDefault();
    const marks = await axios.get(
      `/api/marks/getMarks/${student.student_id}/${selectedYear}/${examName}`
    );
    console.log(marks.data);
    setMarks(marks.data);
    setShow(true);
  };

  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    return Number(student.batch) - i - 1;
  });

  return (
    <>
      <div className="max-w-7xl mx-auto mt-6 px-4">
        <form
          onSubmit={showMarksheet}
          className="flex flex-wrap items-center gap-4 justify-start"
        >
          <div>
            <label
              htmlFor="year"
              className="mr-2 font-medium text-gray-700 dark:text-gray-300"
            >
              Year:
            </label>
            <select
              id="year"
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(Number(e.target.value));
                setExamName("");
                setShow(false);
              }}
              className="border px-4 py-2 rounded-md bg-secondary text-secondary-foreground shadow-md focus:outline-none"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="exam"
              className="mr-2 font-medium text-gray-700 dark:text-gray-300"
            >
              Exam:
            </label>
            <select
              id="exam"
              value={examName}
              onChange={(e) => {
                setExamName(e.target.value);
                setShow(false);
              }}
              required
              className="border px-4 py-2 w-46 rounded-md bg-secondary text-secondary-foreground shadow-md focus:outline-none"
            >
              <option value="">Select exam</option>
              {examList.map((exam) => (
                <option key={exam} value={exam}>
                  {exam}
                </option>
              ))}
            </select>
          </div>

          <Button
            type="submit"
            className="px-4 py-2 rounded-md shadow-md focus:outline-none"
          >
            Show
          </Button>
        </form>
      </div>

      <AnimatePresence>
        {show && (
          <motion.div
            className="mt-8 w-full"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.4 }}
          >
            <MarksheetPage studentInfo={student} marks={marks} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default Result;
