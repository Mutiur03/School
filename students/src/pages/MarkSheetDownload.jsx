import React from "react";
import { Button } from "../components/ui/button";

const Marksheet = ({ studentInfo, marks }) => {
  const hasPassed = marks.every((mark) => mark.marks >= mark.pass_mark);
  console.log(hasPassed);

  const getTotalMarks = () => {
    return marks.reduce((total, mark) => total + mark.marks, 0);
  };
  const getFullMarks = () => {
    return marks.reduce((total, mark) => total + mark.full_mark, 0);
  };
  getTotalMarks();
  getFullMarks();
  const getPercentage = () => {
    const totalMarks = getTotalMarks();
    return ((totalMarks / (marks.length * 100)) * 100).toFixed(2);
  };
  return (
    <div className="print-container p-6 rounded-lg bg-card shadow-2xl max-w-4xl mx-auto ">
      <div className="text-center mb-2">
        <h1 className="text-2xl font-semibold">
          Panchbibi Lal Bihari Pilot Govt. High School
        </h1>
      </div>

      <div className="border-b  w-full pb-4">
        <h2 className="text-center text-xl underline underline-offset-4 underline-dotted font-semibold">
          Student Marksheet
        </h2>
        <div className="grid grid-cols-2 px-4 py-2  text-center">
          <div className="flex items-start flex-col">
            <p className="font-semibold">
              Name: <span>{studentInfo.name}</span>
            </p>
            <p className="font-semibold">
              Roll No: <span>{studentInfo.roll}</span> 
            </p>
          </div>
          <div className="flex items-start flex-col">
            <p className="font-semibold">
              Class: <span>{studentInfo.class}</span>
            </p>
            <p className="font-semibold">
              Section: <span>{studentInfo.section}</span>
            </p>
          </div>
        </div>

        {studentInfo.merit && (
          <p className="text-center text-xl underline underline-offset-4 font-semibold">
            Merit: <span>{studentInfo.merit}</span>
          </p>
        )}
      </div>

      <table className="w-full mt-4 border-collapse border ">
        <thead>
          <tr className="bg-popover">
            <th className="border border-gray-300 px-4 py-2">SL</th>
            <th className="border border-gray-300 px-4 py-2">Subject</th>
            <th className="border border-gray-300 px-4 py-2">Marks</th>
            <th className="border border-gray-300 px-4 py-2">Grade</th>
            <th className="border border-gray-300 px-4 py-2">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {marks.map((subject, index) => {
            const grade = () => {
              if (subject.marks >= 80) {
                return "A+";
              } else if (subject.marks >= 70) {
                return "A";
              } else if (subject.marks >= 60) {
                return "B+";
              } else if (subject.marks >= 50) {
                return "B";
              } else if (subject.marks >= 33) {
                return "C";
              } else {
                return "F";
              }
            };

            const result = grade();
            // console.log(result);

            const remarks =
              subject.marks >= 90
                ? "Excellent"
                : subject.marks >= 80
                ? "Good"
                : subject.marks >= 70
                ? "Average"
                : "Poor";

            return (
              <tr key={index}>
                <td className="border text-center border-gray-300 px-4 py-2">
                  {index + 1}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  {subject.subject}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  {subject.marks}
                </td>
                <td className="border border-gray-300 px-4 py-2">{result}</td>
                <td className="border border-gray-300 px-4 py-2">{remarks}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-4 text-center font-semibold">
        <div className="flex justify-between px-5">
          <p>
            Total: <span>{getTotalMarks()}</span>/ <span>{getFullMarks()}</span>
          </p>
          <p>
            Percentage: <span>{getPercentage()}</span>%
          </p>
        </div>
        <p>Result: {hasPassed ? "Pass" : "Fail"}</p>
      </div>

      <div className="mt-6 flex justify-between">
        <div>
          <div className="border-t-2 border-gray-500 w-40 mt-2"></div>
          <p className="font-semibold">Signature of Student</p>
        </div>
        <div>
          <div className="border-t-2 border-gray-500 w-40 mt-2"></div>
          <p className="font-semibold">Signature of Principal</p>
        </div>
      </div>
    </div>
  );
};

const MarksheetPage = ({ studentInfo, marks }) => {
  

  const handleDownload = (e) => {
    e.preventDefault();
    const url = `http://localhost:3001/api/marks/markSheet/${studentInfo.id}/marks/${marks[0].year}/${marks[0].exam}/download`;
    window.open(url, "_blank");
  };

  return (
    <div className="flex flex-col items-center p-4 min-h-screen">
      <div >
        <Marksheet studentInfo={studentInfo} marks={marks} />
      </div>

      <div className="space-x-3">
        <Button className="mt-6" onClick={handleDownload}>
          Download
        </Button>
      </div>
    </div>
  );
};

export default MarksheetPage;
