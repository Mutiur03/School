import React from "react";
import { Card } from "@/components/ui/card";
import { UserRound } from "lucide-react";
import { useAuth } from "../context/appContext";
import {format} from "date-fns";
const StudentProfile = () => {
  const { student } = useAuth();
  const host = import.meta.env.VITE_BACKEND_URL;
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Card className="flex flex-col md:flex-row gap-6  shadow-xl rounded-2xl p-6 border border-gray-200 transition-shadow duration-300 hover:shadow-2xl">
        <div className="flex-shrink-0 flex items-center justify-center">
          {student.image ? (
            <img
              src={`${host}/${student.image}`}
              alt="Profile"
              className="w-32 h-32 rounded-full border-4 border-gray-300 shadow-sm object-cover"
            />
          ) : (
            <UserRound className="w-32 h-32" />
          )}
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <h2 className="text-3xl font-bold">{student.name}</h2>
            <div className="text-sm space-y-1 mt-1">
              <p>
                <span className="font-medium">Class:</span> {student.class}
              </p>
              <p>
                <span className="font-medium">Section:</span> {student.section}
              </p>
              <p>
                <span className="font-medium">Roll:</span> {student.roll}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-semibold">Father’s Name:</span>{" "}
              {student.father_name}
            </div>
            <div>
              <span className="font-semibold">Mother’s Name:</span>{" "}
              {student.mother_name}
            </div>
            <div>
              <span className="font-semibold">Date of Birth:</span>{" "}
              {format(
                new Date(student.dob),
                "dd MMM yyyy"
              )}
            </div>
            <div>
              <span className="font-semibold">Phone:</span> {student.phone}
            </div>
            <div>
              <span className="font-semibold">Parent's Phone:</span> {student.parent_phone}
            </div>
            <div>
              <span className="font-semibold">Blood Group:</span> {student.blood_group}
            </div>
            <div className="sm:col-span-2">
              <span className="font-semibold">Address:</span> {student.address}
            </div>
          </div>

          {/* <div className="pt-4 mt-4 border-t border-gray-200">
            <h3 className="text-lg font-semibold mb-2">Academic Summary</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Attendance:</span>{" "}
                {student.attendance}%
              </div>
              <div>
                <span className="font-medium">Average Marks:</span>{" "}
                {student.averageMarks}
              </div>
            </div>
          </div> */}
        </div>
      </Card>
    </div>
  );
};

export default StudentProfile;
