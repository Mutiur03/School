"use client"
import { BookOpen, Users, Award, Clock, MapPin, Phone, Mail } from "lucide-react"

export default function GlancePage() {
    return (
        <div className="py-12">
            <div className="container-custom">
                <h1 className="section-title">LBP at a Glance</h1>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
                    <div className="md:col-span-2">
                        <div className="prose max-w-none">
                            <p>
                                Panchbibi LBP govt. High School is a renowned educational institution located in Panchbibi, Joypurhat.
                                Established in 1965, the school has been providing quality education to students for decades.
                            </p>

                            <p>
                                The school offers education from Class 6 to Class 10 following the national curriculum. With a team of
                                dedicated teachers and modern facilities, the school aims to provide a holistic education that nurtures
                                academic excellence, character development, and social responsibility.
                            </p>

                            <h3>Vision</h3>
                            <p>
                                To be a center of excellence in education that nurtures students to become responsible citizens and
                                future leaders.
                            </p>

                            <h3>Mission</h3>
                            <p>
                                Our mission is to provide quality education that fosters intellectual, physical, and moral development
                                of students, preparing them to face the challenges of the 21st century.
                            </p>

                            <h3>Core Values</h3>
                            <ul>
                                <li>Excellence in education</li>
                                <li>Integrity and ethics</li>
                                <li>Respect for diversity</li>
                                <li>Community service</li>
                                <li>Innovation and creativity</li>
                            </ul>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8">
                            <div className="bg-white p-6 rounded-lg shadow-md">
                                <div className="flex items-center mb-4">
                                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mr-4">
                                        <BookOpen size={24} />
                                    </div>
                                    <h3 className="text-xl font-bold">Academic Programs</h3>
                                </div>
                                <ul className="space-y-2 text-gray-600">
                                    <li>• Secondary Education (Class 6-10)</li>
                                    <li>• Science, Arts, and Commerce Streams</li>
                                    <li>• Special Coaching for Board Exams</li>
                                    <li>• Remedial Classes for Weak Students</li>
                                </ul>
                            </div>

                            <div className="bg-white p-6 rounded-lg shadow-md">
                                <div className="flex items-center mb-4">
                                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mr-4">
                                        <Users size={24} />
                                    </div>
                                    <h3 className="text-xl font-bold">Student Body</h3>
                                </div>
                                <ul className="space-y-2 text-gray-600">
                                    <li>• Total Students: 1000+</li>
                                    <li>• Average Class Size: 40 students</li>
                                    <li>• Student-Teacher Ratio: 20:1</li>
                                    <li>• Active Student Council</li>
                                </ul>
                            </div>

                            <div className="bg-white p-6 rounded-lg shadow-md">
                                <div className="flex items-center mb-4">
                                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mr-4">
                                        <Award size={24} />
                                    </div>
                                    <h3 className="text-xl font-bold">Achievements</h3>
                                </div>
                                <ul className="space-y-2 text-gray-600">
                                    <li>• 95% Pass Rate in Board Exams</li>
                                    <li>• District Champions in Sports</li>
                                    <li>• National Science Fair Winners</li>
                                    <li>• Cultural Competition Awards</li>
                                </ul>
                            </div>

                            <div className="bg-white p-6 rounded-lg shadow-md">
                                <div className="flex items-center mb-4">
                                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mr-4">
                                        <Clock size={24} />
                                    </div>
                                    <h3 className="text-xl font-bold">School Hours</h3>
                                </div>
                                <ul className="space-y-2 text-gray-600">
                                    <li>• Sunday to Thursday: 8:00 AM - 1:00 PM</li>
                                    <li>• Friday & Saturday: Closed</li>
                                    <li>• Office Hours: 8:00 AM - 3:00 PM</li>
                                    <li>• Extra-curricular: 1:30 PM - 3:30 PM</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-1">
                        <div className="sticky top-24">
                            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
                                <h3 className="text-xl font-bold mb-4 text-primary">Quick Facts</h3>
                                <ul className="space-y-3">
                                    <li className="flex items-start gap-2">
                                        <span className="font-bold">Established:</span>
                                        <span>1965</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="font-bold">Type:</span>
                                        <span>Government Secondary School</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="font-bold">Campus Size:</span>
                                        <span>5 acres</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="font-bold">Students:</span>
                                        <span>1000+</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="font-bold">Teachers:</span>
                                        <span>50+</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="font-bold">Staff:</span>
                                        <span>20+</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="font-bold">Medium:</span>
                                        <span>Bangla</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="font-bold">Board:</span>
                                        <span>Rajshahi Education Board</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
                                <h3 className="text-xl font-bold mb-4 text-primary">Contact Information</h3>
                                <ul className="space-y-3">
                                    <li className="flex items-start gap-2">
                                        <MapPin size={20} className="mt-1 text-primary shrink-0" />
                                        <span>Panchbibi, Joypurhat, Bangladesh</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Phone size={20} className="text-primary shrink-0" />
                                        <span>+880 1234-567890</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Mail size={20} className="text-primary shrink-0" />
                                        <span>info@panchbibilbp.edu.bd</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="relative h-64 rounded-lg overflow-hidden shadow-md">
                                <img src="/placeholder.svg?height=300&width=400" alt="School Campus"  className="object-cover w-full h-full " />
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-2 text-sm">School Campus</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
