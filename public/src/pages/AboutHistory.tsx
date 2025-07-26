"use client"

export default function HistoryPage() {
    return (
        <div className="py-12">
            <div className="container-custom">
                <h1 className="section-title">School History</h1>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
                    <div className="md:col-span-2">
                        <p className="mb-4">
                            Panchbibi L. B. Pilot Government High School (Bengali: পাঁচবিবি এল. বি. পাইলট সরকারী উচ্চ বিদ্যালয়), locally known as Panchbibi Lal Bihari Pilot Government High School, was established in 1940 in Panchbibi, Joypurhat. The school began with a vision to provide quality education to the boys of Panchbibi and surrounding areas.
                        </p>
                        <p className="mb-4">
                            Over the decades, the school has grown in both size and reputation. It was nationalized in 1986, becoming a government-run institution and further strengthening its commitment to accessible, high-quality education. The school is currently led by Headmaster Md. Ataur Rahman.
                        </p>
                        <p className="mb-4">
                            The campus spans approximately 548 decimals, including a 160-decimal playground, 17,850 square feet of built-up space, and about 54 rooms. The school colors are white and navy blue, and the motto is “Learn it and give all.”
                        </p>
                        <p className="mb-4">
                            Academically, the school offers classes from grade 6 to 10 (SSC level) under the Rajshahi Education Board. With an enrollment of around 1,000 boys aged 11–16 and a student-teacher ratio of about 25:1, the school maintains a strong academic environment.
                        </p>
                        <p className="mb-4">
                            Extracurricular activities are a vital part of student life. The school supports football, cricket, basketball, volleyball, table tennis, badminton, and handball. The in-house magazine, <em>Anushilon</em> (অনুশীলন), showcases student creativity and achievements.
                        </p>
                        <p className="mb-4">
                            Panchbibi L. B. Pilot Government High School is recognized as one of the most prominent government schools in Joypurhat District. Its students consistently achieve strong results in SSC exams, and the school is known for its effective learning environment and active community involvement.
                        </p>
                    </div>
                    <div className="md:col-span-1">
                        <div className="sticky top-24">
                            <div className="bg-gray-50 p-6 rounded-lg shadow-md">
                                <h3 className="text-xl font-bold mb-4 text-primary">Key Milestones</h3>
                                <ul className="space-y-3">
                                    <li className="flex items-start gap-2">
                                        <span className="font-bold">1940:</span>
                                        <span>School established</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="font-bold">1986:</span>
                                        <span>Nationalized as a government school</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="font-bold">2000s:</span>
                                        <span>Campus expansion and modernization</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="font-bold">Ongoing:</span>
                                        <span>Consistent SSC results and community recognition</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="font-bold">Publication:</span>
                                        <span>Launch of school magazine "Anushilon"</span>
                                    </li>
                                </ul>
                            </div>
                            <div className="mt-6 relative h-64 rounded-lg overflow-hidden shadow-md">
                                <img
                                    src="/placeholder.svg?height=300&width=400"
                                    alt="School Building"
                                    className="object-cover w-full h-full"
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-2 text-sm">
                                    School campus in Joypurhat
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
