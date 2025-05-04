"use client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function ClassRoutinePage() {
    return (
        <div className="py-12">
            <div className="container-custom">
                <h1 className="section-title">Class Routine</h1>

                <div className="mt-8">
                    <Tabs defaultValue="class6" className="w-full">
                        <TabsList className="grid grid-cols-2 md:grid-cols-5 mb-8">
                            <TabsTrigger value="class6">Class 6</TabsTrigger>
                            <TabsTrigger value="class7">Class 7</TabsTrigger>
                            <TabsTrigger value="class8">Class 8</TabsTrigger>
                            <TabsTrigger value="class9">Class 9</TabsTrigger>
                            <TabsTrigger value="class10">Class 10</TabsTrigger>
                        </TabsList>

                        {/* Class 6 Routine */}
                        <TabsContent value="class6">
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-primary text-white">
                                            <th className="border p-2">Day/Time</th>
                                            <th className="border p-2">8:00 - 8:45</th>
                                            <th className="border p-2">8:45 - 9:30</th>
                                            <th className="border p-2">9:30 - 10:15</th>
                                            <th className="border p-2">10:15 - 10:45</th>
                                            <th className="border p-2">10:45 - 11:30</th>
                                            <th className="border p-2">11:30 - 12:15</th>
                                            <th className="border p-2">12:15 - 1:00</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2 font-medium">Sunday</td>
                                            <td className="border p-2">Bangla</td>
                                            <td className="border p-2">English</td>
                                            <td className="border p-2">Mathematics</td>
                                            <td className="border p-2 bg-gray-100" rowSpan={6}>
                                                Break
                                            </td>
                                            <td className="border p-2">Science</td>
                                            <td className="border p-2">Social Science</td>
                                            <td className="border p-2">Religion</td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2 font-medium">Monday</td>
                                            <td className="border p-2">Mathematics</td>
                                            <td className="border p-2">Bangla</td>
                                            <td className="border p-2">English</td>
                                            <td className="border p-2">ICT</td>
                                            <td className="border p-2">Science</td>
                                            <td className="border p-2">Physical Education</td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2 font-medium">Tuesday</td>
                                            <td className="border p-2">English</td>
                                            <td className="border p-2">Mathematics</td>
                                            <td className="border p-2">Bangla</td>
                                            <td className="border p-2">Social Science</td>
                                            <td className="border p-2">Agriculture</td>
                                            <td className="border p-2">Science</td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2 font-medium">Wednesday</td>
                                            <td className="border p-2">Science</td>
                                            <td className="border p-2">Social Science</td>
                                            <td className="border p-2">Mathematics</td>
                                            <td className="border p-2">Bangla</td>
                                            <td className="border p-2">English</td>
                                            <td className="border p-2">Arts & Crafts</td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2 font-medium">Thursday</td>
                                            <td className="border p-2">Social Science</td>
                                            <td className="border p-2">Science</td>
                                            <td className="border p-2">Religion</td>
                                            <td className="border p-2">Mathematics</td>
                                            <td className="border p-2">Bangla</td>
                                            <td className="border p-2">English</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </TabsContent>

                        {/* Class 7 Routine */}
                        <TabsContent value="class7">
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-primary text-white">
                                            <th className="border p-2">Day/Time</th>
                                            <th className="border p-2">8:00 - 8:45</th>
                                            <th className="border p-2">8:45 - 9:30</th>
                                            <th className="border p-2">9:30 - 10:15</th>
                                            <th className="border p-2">10:15 - 10:45</th>
                                            <th className="border p-2">10:45 - 11:30</th>
                                            <th className="border p-2">11:30 - 12:15</th>
                                            <th className="border p-2">12:15 - 1:00</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2 font-medium">Sunday</td>
                                            <td className="border p-2">English</td>
                                            <td className="border p-2">Bangla</td>
                                            <td className="border p-2">Mathematics</td>
                                            <td className="border p-2 bg-gray-100" rowSpan={6}>
                                                Break
                                            </td>
                                            <td className="border p-2">Science</td>
                                            <td className="border p-2">Social Science</td>
                                            <td className="border p-2">Religion</td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2 font-medium">Monday</td>
                                            <td className="border p-2">Mathematics</td>
                                            <td className="border p-2">English</td>
                                            <td className="border p-2">Bangla</td>
                                            <td className="border p-2">ICT</td>
                                            <td className="border p-2">Science</td>
                                            <td className="border p-2">Physical Education</td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2 font-medium">Tuesday</td>
                                            <td className="border p-2">Bangla</td>
                                            <td className="border p-2">Mathematics</td>
                                            <td className="border p-2">English</td>
                                            <td className="border p-2">Social Science</td>
                                            <td className="border p-2">Agriculture</td>
                                            <td className="border p-2">Science</td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2 font-medium">Wednesday</td>
                                            <td className="border p-2">Science</td>
                                            <td className="border p-2">Social Science</td>
                                            <td className="border p-2">Mathematics</td>
                                            <td className="border p-2">English</td>
                                            <td className="border p-2">Bangla</td>
                                            <td className="border p-2">Arts & Crafts</td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2 font-medium">Thursday</td>
                                            <td className="border p-2">Social Science</td>
                                            <td className="border p-2">Science</td>
                                            <td className="border p-2">Religion</td>
                                            <td className="border p-2">Mathematics</td>
                                            <td className="border p-2">English</td>
                                            <td className="border p-2">Bangla</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </TabsContent>

                        {/* Placeholder for other class routines */}
                        <TabsContent value="class8">
                            <div className="bg-gray-50 p-8 rounded-lg text-center">
                                <h3 className="text-xl font-medium text-gray-600">Class 8 Routine</h3>
                                <p className="mt-2 text-gray-500">Routine will be updated soon.</p>
                            </div>
                        </TabsContent>

                        <TabsContent value="class9">
                            <div className="bg-gray-50 p-8 rounded-lg text-center">
                                <h3 className="text-xl font-medium text-gray-600">Class 9 Routine</h3>
                                <p className="mt-2 text-gray-500">Routine will be updated soon.</p>
                            </div>
                        </TabsContent>

                        <TabsContent value="class10">
                            <div className="bg-gray-50 p-8 rounded-lg text-center">
                                <h3 className="text-xl font-medium text-gray-600">Class 10 Routine</h3>
                                <p className="mt-2 text-gray-500">Routine will be updated soon.</p>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                <div className="mt-8 bg-yellow-50 border-l-4 border-yellow-400 p-4">
                    <h3 className="text-lg font-medium text-yellow-800">Note:</h3>
                    <ul className="mt-2 space-y-1 text-yellow-700">
                        <li>• School starts at 8:00 AM and ends at 1:00 PM.</li>
                        <li>• Students should arrive at school at least 15 minutes before the first class.</li>
                        <li>• Break time is from 10:15 AM to 10:45 AM.</li>
                        <li>• This routine is effective from April 1, 2024.</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}
