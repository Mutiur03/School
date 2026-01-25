import React, { useEffect } from "react";
import { schoolConfig } from "@/lib/info";

export default function At_a_glance() {
  useEffect(() => {
    document.title = "At a Glance";
  }, []);
  const allRows: { label: string; value: React.ReactNode }[] = [
    {
      label: "College / School Name",
      value: `${schoolConfig.name.en} (${schoolConfig.name.bn})`,
    },
    { label: "Website", value: schoolConfig.contact.website },
    { label: "E-mail", value: schoolConfig.contact.email },
    { label: "Phone", value: schoolConfig.contact.phone },
    { label: "Code (EIIN)", value: schoolConfig.identifiers.eiin },
    { label: "Center Code", value: schoolConfig.identifiers.centerCode },
    { label: "Location", value: schoolConfig.contact.location },
    { label: "Established", value: schoolConfig.history.established },
    { label: "Nationalized", value: schoolConfig.history.nationalized },
    { label: "Grades", value: schoolConfig.academic.grades },
    { label: "Enrollment", value: schoolConfig.academic.enrollment },
    {
      label: "Student-Teacher Ratio",
      value: schoolConfig.academic.studentTeacherRatio,
    },
    { label: "Medium", value: schoolConfig.academic.medium },
    { label: "Board", value: schoolConfig.academic.board },
    { label: "Campus / Land Area", value: schoolConfig.academic.campusArea },
    { label: "Playground", value: schoolConfig.academic.playgroundArea },
    { label: "Headmaster", value: schoolConfig.academic.headmaster },
    { label: "School Colors", value: schoolConfig.academic.colors },

    {
      label: "Description",
      value: (
        <div>
          <p className="text-sm leading-relaxed text-gray-700 mb-2">
            {schoolConfig.descriptions.main}
          </p>
          <p className="text-sm leading-relaxed text-gray-600">
            {schoolConfig.descriptions.sub}
          </p>
        </div>
      ),
    },

    {
      label: "Academic Programs",
      value: (
        <ul className="list-disc pl-5 text-sm text-gray-600">
          <li>Secondary Education ({schoolConfig.academic.grades} level)</li>
          <li>National Curriculum ({schoolConfig.academic.medium} medium)</li>
          <li>{schoolConfig.academic.subjects}</li>
          <li>Special care for board exams</li>
        </ul>
      ),
    },

    {
      label: "Student Body",
      value: (
        <ul className="list-disc pl-5 text-sm text-gray-600">
          <li>Enrollment: {schoolConfig.academic.enrollment}</li>
          <li>Age Range: {schoolConfig.academic.ageRange}</li>
          <li>
            Student-Teacher Ratio: {schoolConfig.academic.studentTeacherRatio}
          </li>
          {/* <li>Active Student Council & Publication "Anushilon"</li> */}
        </ul>
      ),
    },

    {
      label: "Achievements & Reputation",
      value: (
        <ul className="list-disc pl-5 text-sm text-gray-600">
          <li>Consistently strong SSC results</li>
          <li>
            Recognized as a leading school in{" "}
            {schoolConfig.contact.location.split(",")[1]?.trim() ||
              schoolConfig.contact.location}
          </li>
          <li>Notable alumni and community impact</li>
          {/* <li>School magazine: "Anushilon"</li> */}
        </ul>
      ),
    },

    {
      label: "School Details",
      value: (
        <ul className="list-disc pl-5 text-sm text-gray-600">
          <li>Founded: {schoolConfig.history.established}</li>
          <li>Nationalized: {schoolConfig.history.nationalized}</li>
          <li>Motto: “{schoolConfig.academic.motto}”</li>
          <li>School Colors: {schoolConfig.academic.colors}</li>
        </ul>
      ),
    },

    { label: "Address", value: schoolConfig.contact.address },
    { label: "Contact Phone", value: schoolConfig.contact.phone },
    { label: "Contact E-mail", value: schoolConfig.contact.email },

    {
      label: "Campus Image",
      value: (
        <div className="w-full max-w-md">
          <img
            src={schoolConfig.assets.banners[0]}
            alt="School Campus"
            className="object-cover w-full h-48 rounded-md shadow-sm"
          />
          <div className="text-xs text-gray-500 mt-1">School Campus</div>
        </div>
      ),
    },
  ];

  const renderCellValue = (val: React.ReactNode) => {
    if (typeof val === "string") {
      return val.trim()
        ? val.split("\n").map((line, i) => (
            <div key={i} className="leading-relaxed">
              {line}
            </div>
          ))
        : "—";
    }
    return val ?? "—";
  };

  return (
    <div className=" py-12">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-4xl">At a glance</h2>

        <div className="mt-8">
          <div className="bg-white rounded-xs shadow overflow-hidden">
            <table className="min-w-full text-sm border-collapse">
              <tbody className="border border-gray-300">
                {allRows.map((row, idx) => {
                  const isEven = idx % 2 === 0;
                  return (
                    <tr
                      key={row.label}
                      className={isEven ? "bg-gray-50" : "bg-white"}
                    >
                      <td className="align-top py-4 px-4 w-5/12 font-semibold  border-b border-gray-300">
                        {row.label}
                      </td>
                      <td className="align-top py-4 px-2 w-12 text-center  border-b border-gray-300">
                        :
                      </td>
                      <td className="py-4 px-4  border-b border-gray-300">
                        {renderCellValue(row.value)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
