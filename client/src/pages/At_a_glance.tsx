import React from "react"

export default function At_a_glance() {
    const allRows: { label: string; value: React.ReactNode }[] = [
        {
            label: "College / School Name",
            value: "Panchbibi Lal Bihari Pilot Government High School (পাঁচবিবি লাল বিহারী পাইলট সরকারি উচ্চ বিদ্যালয়)",
        },
        { label: "Website", value: "www.lbphs.gov.bd" },
        { label: "E-mail", value: "lbpgovtschool@gmail.com" },
        { label: "Phone", value: "+880 1309-121983" },
        { label: "Code (EIIN)", value: "121983" },
        { label: "Center Code", value: "484" },
        { label: "Location", value: "Damdama, Panchbibi." },
        { label: "Established", value: "1940" },
        { label: "Nationalized", value: "1987" },
        { label: "Grades", value: "6–10 (SSC)" },
        { label: "Enrollment", value: "~600 boys" },
        { label: "Student-Teacher Ratio", value: "~30:1" },
        { label: "Medium", value: "Bangla" },
        { label: "Board", value: "Rajshahi Education Board" },
        { label: "Campus / Land Area", value: "~548 decimals (campus), 54 rooms" },
        { label: "Playground", value: "160 decimals" },
        { label: "Headmaster", value: "Md Ataur Rahman" },
        { label: "School Colors", value: "White & Navy Blue" },

        {
            label: "Description",
            value: (
                <div>
                    <p className="text-sm leading-relaxed text-gray-700 mb-2">
                        Panchbibi Lal Bihari Pilot Government High School (Bengali: পাঁচবিবি লাল বিহারী পাইলট সরকারি উচ্চ বিদ্যালয়),
                        formerly known as Panchbibi L. B. Pilot Government High School, is a prominent boys’ secondary school located in
                        Panchbibi Upazila, Joypurhat District, Rajshahi Division, Bangladesh. Established in 1940, the school has a long-standing
                        reputation for academic excellence and community leadership.
                    </p>
                    <p className="text-sm leading-relaxed text-gray-600">
                        The school offers education from Class 6 to Class 10 (SSC level) under the Rajshahi Education Board. With a dedicated faculty
                        led by Headmaster Md. Ataur Rahman, and a student body of around 600 boys aged 11–16, the school provides a holistic
                        environment that fosters academic achievement, character development, and social responsibility.
                    </p>
                </div>
            ),
        },

        {
            label: "Academic Programs",
            value: (
                <ul className="list-disc pl-5 text-sm text-gray-600">
                    <li>Secondary Education (Class 6–10, SSC level)</li>
                    <li>National Curriculum (Bangla medium)</li>
                    <li>Science and Humanities</li>
                    <li>Special care for board exams</li>
                </ul>
            ),
        },

        {
            label: "Student Body",
            value: (
                <ul className="list-disc pl-5 text-sm text-gray-600">
                    <li>Enrollment: ~600 boys</li>
                    <li>Age Range: 11–16 years</li>
                    <li>Student-Teacher Ratio: ~30:1</li>
                    {/* <li>Active Student Council & Publication "Anushilon"</li> */}
                </ul>
            ),
        },

        {
            label: "Achievements & Reputation",
            value: (
                <ul className="list-disc pl-5 text-sm text-gray-600">
                    <li>Consistently strong SSC results</li>
                    <li>Recognized as a leading school in Joypurhat</li>
                    <li>Notable alumni and community impact</li>
                    {/* <li>School magazine: "Anushilon"</li> */}
                </ul>
            ),
        },

        {
            label: "School Details",
            value: (
                <ul className="list-disc pl-5 text-sm text-gray-600">
                    <li>Founded: 1940</li>
                    <li>Nationalized: 1987</li>
                    <li>Motto: “Learn it and give all”</li>
                    <li>School Colors: White & Navy Blue</li>
                </ul>
            ),
        },

        { label: "Address", value: "Panchbibi, Joypurhat, Rajshahi Division, Bangladesh" },
        { label: "Contact Phone", value: "+880 1309-121983" },
        { label: "Contact E-mail", value: "lbpgovtschool@gmail.com" },

        {
            label: "Campus Image",
            value: (
                <div className="w-full max-w-md">
                    <img src="/placeholder.svg?height=300&width=400" alt="School Campus" className="object-cover w-full h-48 rounded-md shadow-sm" />
                    <div className="text-xs text-gray-500 mt-1">School Campus</div>
                </div>
            ),
        },
    ]

    const renderCellValue = (val: React.ReactNode) => {
        if (typeof val === "string") {
            return val.trim()
                ? val.split("\n").map((line, i) => (
                    <div key={i} className="leading-relaxed">
                        {line}
                    </div>
                ))
                : "—"
        }
        return val ?? "—"
    }

    return (
        <div className=" py-12">
            <div className="max-w-6xl mx-auto px-4">
                <h2 className="text-4xl">At a glance</h2>

                <div className="mt-8">
                    <div className="bg-white rounded-xs shadow overflow-hidden">
                        <table className="min-w-full text-sm border-collapse">
                            <tbody className="border-1 border-gray-300">
                                {allRows.map((row, idx) => {
                                    const isEven = idx % 2 === 0
                                    return (
                                        <tr key={row.label} className={isEven ? "bg-gray-50" : "bg-white"}>
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
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
