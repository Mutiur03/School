"use client";
import { useAuth } from "@/context/authContext";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import { fixURL } from "@/lib/fixURL";
export default function TeacherProfile() {
  const { teacher } = useAuth();
  return (
    <div className="p-6 max-w-4xl mx-auto">
      {!teacher ? null : (
        <Card className="flex flex-col md:flex-row gap-6 shadow-xl rounded-2xl p-6 border border-gray-200 transition-shadow duration-300 hover:shadow-2xl">
          <div className="h-56 w-56 rounded-full border-4 border-gray-300 shadow-sm overflow-hidden">
            {teacher?.image ? (
              <Image
                src={fixURL(teacher.image)}
                alt="Profile"
                width={128}
                height={128}
                className="w-full h-full object-cover object-top"
                unoptimized
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center text-4xl">👤</div>
            )}
          </div>
          <div className="flex-1 space-y-4">
            <h2 className="text-3xl font-bold">{teacher?.name}</h2>
            <div className="text-sm space-y-1 mt-1">
              <p><span className="font-medium">Email:</span> {teacher?.email}</p>
              <p><span className="font-medium">Phone:</span> {teacher?.phone}</p>
              <p><span className="font-medium">Designation:</span> {teacher?.designation}</p>
            </div>
            <div className="mt-4">
              <span className="font-semibold">Address:</span> {teacher?.address}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
