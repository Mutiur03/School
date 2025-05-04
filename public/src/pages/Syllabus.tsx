"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SyllabusPage() {
    return (
        <div className="py-12">
            <div className="container-custom">
                <h1 className="section-title">Class Syllabus</h1>

                <div className="mt-8">
                    <Tabs defaultValue="class6" className="w-full">
                        <TabsList className="grid grid-cols-2 md:grid-cols-5 mb-8">
                            <TabsTrigger value="class6">Class 6</TabsTrigger>
                            <TabsTrigger value="class7">Class 7</TabsTrigger>
                            <TabsTrigger value="class8">Class 8</TabsTrigger>
                            <TabsTrigger value="class9">Class 9</TabsTrigger>
                            <TabsTrigger value="class10">Class 10</TabsTrigger>
                        </TabsList>

                        {/* Class 6 Syllabus */}
                        <TabsContent value="class6">
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-primary text-white">
                                            <th className="border p-2">Subject</th>
                                            <th className="border p-2">Chapters/Topics</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2 font-medium">Bangla</td>
                                            <td className="border p-2">
                                                Chapters 1-10, Poems 1-5, Grammar basics
                                            </td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2 font-medium">English</td>
                                            <td className="border p-2">
                                                Units 1-8, Grammar, Composition, Comprehension
                                            </td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2 font-medium">Mathematics</td>
                                            <td className="border p-2">
                                                Chapters 1-12, Geometry basics, Word problems
                                            </td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2 font-medium">Science</td>
                                            <td className="border p-2">
                                                Chapters 1-8, Experiments, Diagrams
                                            </td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2 font-medium">Social Science</td>
                                            <td className="border p-2">
                                                History, Geography, Civics (Chapters 1-7)
                                            </td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2 font-medium">Religion</td>
                                            <td className="border p-2">
                                                Chapters 1-5, Prayers, Stories
                                            </td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2 font-medium">ICT</td>
                                            <td className="border p-2">
                                                Basics of Computers, Internet, Practical
                                            </td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2 font-medium">
                                                Physical Education
                                            </td>
                                            <td className="border p-2">Health, Games, Exercises</td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2 font-medium">Arts & Crafts</td>
                                            <td className="border p-2">
                                                Drawing, Craftwork, Projects
                                            </td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2 font-medium">Agriculture</td>
                                            <td className="border p-2">
                                                Basics of Agriculture, Projects
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </TabsContent>

                        {/* Class 7 Syllabus */}
                        <TabsContent value="class7">
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-primary text-white">
                                            <th className="border p-2">Subject</th>
                                            <th className="border p-2">Chapters/Topics</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2 font-medium">Bangla</td>
                                            <td className="border p-2">
                                                Chapters 1-12, Poems 1-6, Grammar advanced
                                            </td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2 font-medium">English</td>
                                            <td className="border p-2">
                                                Units 1-10, Grammar, Letter/Application Writing
                                            </td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2 font-medium">Mathematics</td>
                                            <td className="border p-2">
                                                Chapters 1-14, Algebra basics, Geometry
                                            </td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2 font-medium">Science</td>
                                            <td className="border p-2">
                                                Chapters 1-10, Experiments, Diagrams
                                            </td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2 font-medium">Social Science</td>
                                            <td className="border p-2">
                                                History, Geography, Civics (Chapters 1-9)
                                            </td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2 font-medium">Religion</td>
                                            <td className="border p-2">
                                                Chapters 1-6, Prayers, Stories
                                            </td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2 font-medium">ICT</td>
                                            <td className="border p-2">
                                                Word Processing, Internet, Practical
                                            </td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2 font-medium">
                                                Physical Education
                                            </td>
                                            <td className="border p-2">Health, Games, Teamwork</td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2 font-medium">Arts & Crafts</td>
                                            <td className="border p-2">
                                                Drawing, Painting, Projects
                                            </td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="border p-2 font-medium">Agriculture</td>
                                            <td className="border p-2">Crop Science, Projects</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </TabsContent>

                        {/* Placeholder for other class syllabuses */}
                        <TabsContent value="class8">
                            <div className="bg-gray-50 p-8 rounded-lg text-center">
                                <h3 className="text-xl font-medium text-gray-600">
                                    Class 8 Syllabus
                                </h3>
                                <p className="mt-2 text-gray-500">
                                    Syllabus will be updated soon.
                                </p>
                            </div>
                        </TabsContent>

                        <TabsContent value="class9">
                            <div className="bg-gray-50 p-8 rounded-lg text-center">
                                <h3 className="text-xl font-medium text-gray-600">
                                    Class 9 Syllabus
                                </h3>
                                <p className="mt-2 text-gray-500">
                                    Syllabus will be updated soon.
                                </p>
                            </div>
                        </TabsContent>

                        <TabsContent value="class10">
                            <div className="bg-gray-50 p-8 rounded-lg text-center">
                                <h3 className="text-xl font-medium text-gray-600">
                                    Class 10 Syllabus
                                </h3>
                                <p className="mt-2 text-gray-500">
                                    Syllabus will be updated soon.
                                </p>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                <div className="mt-8 bg-blue-50 border-l-4 border-blue-400 p-4">
                    <h3 className="text-lg font-medium text-blue-800">Note:</h3>
                    <ul className="mt-2 space-y-1 text-blue-700">
                        <li>• Syllabus is subject to change as per school guidelines.</li>
                        <li>
                            • Students should refer to the latest textbooks and teacher
                            instructions.
                        </li>
                        <li>• For detailed syllabus, contact the class teacher.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
