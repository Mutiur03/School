"use client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ExamRoutinePage() {
    return (
        <div className="py-12">
            <div className="container-custom">
                <h1 className="section-title">Exam Routine</h1>

                <div className="mt-8">
                    <Tabs defaultValue="class6" className="w-full">
                        <TabsList className="grid grid-cols-2 md:grid-cols-5 mb-8">
                            <TabsTrigger value="class6">Class 6</TabsTrigger>
                            <TabsTrigger value="class7">Class 7</TabsTrigger>
                            <TabsTrigger value="class8">Class 8</TabsTrigger>
                            <TabsTrigger value="class9">Class 9</TabsTrigger>
                            <TabsTrigger value="class10">Class 10</TabsTrigger>
                        </TabsList>

                        {/* Class 6 Exam Routine */}
                        <TabsContent value="class6">
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-primary text-white">
                                            <th className="border p-2">Date</th>
                                            <th className="border p-2">Day</th>
                                            <th className="border p-2">Subject</th>
                                            <th className="border p-2">Time</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2">2024-06-02</td>
                                            <td className="border p-2 font-medium">Sunday</td>
                                            <td className="border p-2">Bangla</td>
                                            <td className="border p-2">8:30 AM - 10:30 AM</td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2">2024-06-03</td>
                                            <td className="border p-2 font-medium">Monday</td>
                                            <td className="border p-2">English</td>
                                            <td className="border p-2">8:30 AM - 10:30 AM</td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2">2024-06-04</td>
                                            <td className="border p-2 font-medium">Tuesday</td>
                                            <td className="border p-2">Mathematics</td>
                                            <td className="border p-2">8:30 AM - 10:30 AM</td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2">2024-06-05</td>
                                            <td className="border p-2 font-medium">Wednesday</td>
                                            <td className="border p-2">Science</td>
                                            <td className="border p-2">8:30 AM - 10:30 AM</td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2">2024-06-06</td>
                                            <td className="border p-2 font-medium">Thursday</td>
                                            <td className="border p-2">Social Science</td>
                                            <td className="border p-2">8:30 AM - 10:30 AM</td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2">2024-06-08</td>
                                            <td className="border p-2 font-medium">Saturday</td>
                                            <td className="border p-2">Religion</td>
                                            <td className="border p-2">8:30 AM - 10:00 AM</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </TabsContent>

                        {/* Class 7 Exam Routine */}
                        <TabsContent value="class7">
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-primary text-white">
                                            <th className="border p-2">Date</th>
                                            <th className="border p-2">Day</th>
                                            <th className="border p-2">Subject</th>
                                            <th className="border p-2">Time</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2">2024-06-02</td>
                                            <td className="border p-2 font-medium">Sunday</td>
                                            <td className="border p-2">English</td>
                                            <td className="border p-2">8:30 AM - 10:30 AM</td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2">2024-06-03</td>
                                            <td className="border p-2 font-medium">Monday</td>
                                            <td className="border p-2">Bangla</td>
                                            <td className="border p-2">8:30 AM - 10:30 AM</td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2">2024-06-04</td>
                                            <td className="border p-2 font-medium">Tuesday</td>
                                            <td className="border p-2">Mathematics</td>
                                            <td className="border p-2">8:30 AM - 10:30 AM</td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2">2024-06-05</td>
                                            <td className="border p-2 font-medium">Wednesday</td>
                                            <td className="border p-2">Science</td>
                                            <td className="border p-2">8:30 AM - 10:30 AM</td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2">2024-06-06</td>
                                            <td className="border p-2 font-medium">Thursday</td>
                                            <td className="border p-2">Social Science</td>
                                            <td className="border p-2">8:30 AM - 10:30 AM</td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2">2024-06-08</td>
                                            <td className="border p-2 font-medium">Saturday</td>
                                            <td className="border p-2">Religion</td>
                                            <td className="border p-2">8:30 AM - 10:00 AM</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </TabsContent>

                        {/* Placeholder for other class exam routines */}
                        <TabsContent value="class8">
                            <div className="bg-gray-50 p-8 rounded-lg text-center">
                                <h3 className="text-xl font-medium text-gray-600">
                                    Class 8 Exam Routine
                                </h3>
                                <p className="mt-2 text-gray-500">
                                    Exam routine will be updated soon.
                                </p>
                            </div>
                        </TabsContent>

                        <TabsContent value="class9">
                            <div className="bg-gray-50 p-8 rounded-lg text-center">
                                <h3 className="text-xl font-medium text-gray-600">
                                    Class 9 Exam Routine
                                </h3>
                                <p className="mt-2 text-gray-500">
                                    Exam routine will be updated soon.
                                </p>
                            </div>
                        </TabsContent>

                        <TabsContent value="class10">
                            <div className="bg-gray-50 p-8 rounded-lg text-center">
                                <h3 className="text-xl font-medium text-gray-600">
                                    Class 10 Exam Routine
                                </h3>
                                <p className="mt-2 text-gray-500">
                                    Exam routine will be updated soon.
                                </p>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                <div className="mt-8 bg-yellow-50 border-l-4 border-yellow-400 p-4">
                    <h3 className="text-lg font-medium text-yellow-800">Note:</h3>
                    <ul className="mt-2 space-y-1 text-yellow-700">
                        <li>
                            • Exam starts at 8:30 AM. Students must arrive at least 20 minutes
                            before the exam.
                        </li>
                        <li>• Bring your admit card and necessary stationery.</li>
                        <li>
                            • No mobile phones or electronic devices are allowed in the exam
                            hall.
                        </li>
                        <li>• Follow all instructions given by the invigilators.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
