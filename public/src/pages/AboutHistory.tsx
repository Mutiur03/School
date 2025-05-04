"use client"

export default function HistoryPage() {
    return (
        <div className="py-12">
            <div className="container-custom">
                <h1 className="section-title">School History</h1>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
                    <div className="md:col-span-2">
                        <p className="mb-4">
                            Panchbibi LBP govt. High School was established in 1965 with a vision to provide quality education to the
                            students of Panchbibi and surrounding areas. The school started its journey with just a few classrooms and
                            a handful of students.
                        </p>
                        <p className="mb-4">
                            Over the years, the school has grown significantly in terms of infrastructure, faculty, and student
                            enrollment. The school has produced numerous successful alumni who have made significant contributions in
                            various fields.
                        </p>
                        <p className="mb-4">
                            In 1980, the school was nationalized and renamed as Panchbibi LBP govt. High School. Since then, the
                            school has been receiving government support for its operations and development.
                        </p>
                        <p className="mb-4">
                            The school has witnessed several milestones in its journey. In 1990, a new academic building was
                            constructed to accommodate the growing number of students. In 2000, the school celebrated its 35th
                            anniversary with a grand ceremony attended by distinguished alumni and local dignitaries.
                        </p>
                        <p className="mb-4">
                            In recent years, the school has embraced modern teaching methodologies and technologies to enhance the
                            learning experience. Computer labs, science laboratories, and a well-stocked library have been added to
                            the school's facilities. The school continues to uphold its tradition of academic excellence while
                            adapting to the changing educational landscape.
                        </p>
                        <p className="mb-4">
                            Today, Panchbibi LBP govt. High School stands as a symbol of educational excellence in the region, with a
                            strong commitment to nurturing the intellectual, physical, and moral development of its students.
                        </p>
                    </div>
                    <div className="md:col-span-1">
                        <div className="sticky top-24">
                            <div className="bg-gray-50 p-6 rounded-lg shadow-md">
                                <h3 className="text-xl font-bold mb-4 text-primary">Key Milestones</h3>
                                <ul className="space-y-3">
                                    <li className="flex items-start gap-2">
                                        <span className="font-bold">1965:</span>
                                        <span>School established</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="font-bold">1980:</span>
                                        <span>Nationalized as LBP govt. High School</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="font-bold">1990:</span>
                                        <span>New academic building constructed</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="font-bold">2000:</span>
                                        <span>35th anniversary celebration</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="font-bold">2010:</span>
                                        <span>Computer lab established</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="font-bold">2015:</span>
                                        <span>Golden Jubilee celebration</span>
                                    </li>
                                </ul>
                            </div>
                            <div className="mt-6 relative h-64 rounded-lg overflow-hidden shadow-md">
                                <img
                                    src="/placeholder.svg?height=300&width=400"
                                    alt="Old School Building"
                                    
                                    className="object-cover w-full h-full"
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-2 text-sm">
                                    School building in 1970s
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
