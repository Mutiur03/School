"use client"
import { BookOpen, Users, Award, Clock, MapPin, Phone, Mail } from "lucide-react"

export default function GlancePage() {
    return (
        <div className="glance-page py-12">
            <div className="container-custom">
                <h1 className="section-title page-title text-4xl md:text-5xl font-bold text-center mb-8">LBP at a Glance</h1>

                <div className="content-grid grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
                    <div className="main-content md:col-span-2">
                        <div className="school-description prose max-w-none">
                            <p className="intro-paragraph text-lg leading-relaxed text-gray-700 mb-6">
                                Panchbibi LBP govt. High School is a renowned educational institution located in Panchbibi, Joypurhat.
                                Established in 1940, the school has been providing quality education to students for decades.
                            </p>

                            <p className="description-paragraph text-base leading-relaxed text-gray-600 mb-8">
                                The school offers education from Class 6 to Class 10 following the national curriculum. With a team of
                                dedicated teachers and modern facilities, the school aims to provide a holistic education that nurtures
                                academic excellence, character development, and social responsibility.
                            </p>

                   
                        </div>

                        <div className="info-cards-grid grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8">
                            <div className="info-card academic-card bg-white p-6 rounded-lg shadow-md">
                                <div className="card-header flex items-center mb-4">
                                    <div className="icon-container w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mr-4">
                                        <BookOpen size={24} />
                                    </div>
                                    <h3 className="card-title text-xl font-bold text-gray-800">Academic Programs</h3>
                                </div>
                                <ul className="card-list space-y-2 text-gray-600">
                                    <li className="list-item text-sm">• Secondary Education (Class 6-10)</li>
                                    <li className="list-item text-sm">• Science, Arts, and Commerce Streams</li>
                                    <li className="list-item text-sm">• Special Coaching for Board Exams</li>
                                    <li className="list-item text-sm">• Remedial Classes for Weak Students</li>
                                </ul>
                            </div>

                            <div className="info-card student-card bg-white p-6 rounded-lg shadow-md">
                                <div className="card-header flex items-center mb-4">
                                    <div className="icon-container w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mr-4">
                                        <Users size={24} />
                                    </div>
                                    <h3 className="card-title text-xl font-bold text-gray-800">Student Body</h3>
                                </div>
                                <ul className="card-list space-y-2 text-gray-600">
                                    <li className="list-item text-sm">• Total Students: 500+</li>
                                    <li className="list-item text-sm">• Average Class Size: 120 students</li>
                                    <li className="list-item text-sm">• Student-Teacher Ratio: 15:1</li>
                                    <li className="list-item text-sm">• Active Student Council</li>
                                </ul>
                            </div>

                            <div className="info-card achievements-card bg-white p-6 rounded-lg shadow-md">
                                <div className="card-header flex items-center mb-4">
                                    <div className="icon-container w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mr-4">
                                        <Award size={24} />
                                    </div>
                                    <h3 className="card-title text-xl font-bold text-gray-800">Achievements</h3>
                                </div>
                                <ul className="card-list space-y-2 text-gray-600">
                                    <li className="list-item text-sm">• 99% Pass Rate in Board Exams</li>
                                    <li className="list-item text-sm">• District Champions in Sports</li>
                                    <li className="list-item text-sm">• National Science Fair Winners</li>
                                    <li className="list-item text-sm">• Cultural Competition Awards</li>
                                </ul>
                            </div>

                            <div className="info-card schedule-card bg-white p-6 rounded-lg shadow-md">
                                <div className="card-header flex items-center mb-4">
                                    <div className="icon-container w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mr-4">
                                        <Clock size={24} />
                                    </div>
                                    <h3 className="card-title text-xl font-bold text-gray-800">School Hours</h3>
                                </div>
                                <ul className="card-list space-y-2 text-gray-600">
                                    <li className="list-item text-sm">• Sunday to Thursday: 8:00 AM - 1:00 PM</li>
                                    <li className="list-item text-sm">• Friday & Saturday: Closed</li>
                                    <li className="list-item text-sm">• Office Hours: 8:00 AM - 3:00 PM</li>
                                    <li className="list-item text-sm">• Extra-curricular: 1:30 PM - 3:30 PM</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="sidebar md:col-span-1">
                        <div className="sidebar-content sticky top-24">
                            <div className="quick-facts-card bg-white p-6 rounded-lg shadow-md mb-6">
                                <h3 className="card-title text-xl font-bold mb-4 text-primary">Quick Facts</h3>
                                <ul className="facts-list space-y-3">
                                    <li className="fact-item flex items-start gap-2">
                                        <span className="fact-label font-semibold text-sm text-gray-700">Established:</span>
                                        <span className="fact-value text-sm text-gray-600">1965</span>
                                    </li>
                                    <li className="fact-item flex items-start gap-2">
                                        <span className="fact-label font-semibold text-sm text-gray-700">Type:</span>
                                        <span className="fact-value text-sm text-gray-600">Government Secondary School</span>
                                    </li>
                                    <li className="fact-item flex items-start gap-2">
                                        <span className="fact-label font-semibold text-sm text-gray-700">Campus Size:</span>
                                        <span className="fact-value text-sm text-gray-600">5 acres</span>
                                    </li>
                                    <li className="fact-item flex items-start gap-2">
                                        <span className="fact-label font-semibold text-sm text-gray-700">Students:</span>
                                        <span className="fact-value text-sm text-gray-600">1000+</span>
                                    </li>
                                    <li className="fact-item flex items-start gap-2">
                                        <span className="fact-label font-semibold text-sm text-gray-700">Teachers:</span>
                                        <span className="fact-value text-sm text-gray-600">50+</span>
                                    </li>
                                    <li className="fact-item flex items-start gap-2">
                                        <span className="fact-label font-semibold text-sm text-gray-700">Staff:</span>
                                        <span className="fact-value text-sm text-gray-600">20+</span>
                                    </li>
                                    <li className="fact-item flex items-start gap-2">
                                        <span className="fact-label font-semibold text-sm text-gray-700">Medium:</span>
                                        <span className="fact-value text-sm text-gray-600">Bangla</span>
                                    </li>
                                    <li className="fact-item flex items-start gap-2">
                                        <span className="fact-label font-semibold text-sm text-gray-700">Board:</span>
                                        <span className="fact-value text-sm text-gray-600">Rajshahi Education Board</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="contact-card bg-white p-6 rounded-lg shadow-md mb-6">
                                <h3 className="card-title text-xl font-bold mb-4 text-primary">Contact Information</h3>
                                <ul className="contact-list space-y-3">
                                    <li className="contact-item flex items-start gap-2">
                                        <MapPin size={20} className="contact-icon mt-1 text-primary shrink-0" />
                                        <span className="contact-text text-sm text-gray-600">Panchbibi, Joypurhat, Bangladesh</span>
                                    </li>
                                    <li className="contact-item flex items-center gap-2">
                                        <Phone size={20} className="contact-icon text-primary shrink-0" />
                                        <span className="contact-text text-sm text-gray-600">+880 1234-567890</span>
                                    </li>
                                    <li className="contact-item flex items-center gap-2">
                                        <Mail size={20} className="contact-icon text-primary shrink-0" />
                                        <span className="contact-text text-sm text-gray-600">info@panchbibilbp.edu.bd</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="campus-image-container relative h-64 rounded-lg overflow-hidden shadow-md">
                                <img src="/placeholder.svg?height=300&width=400" alt="School Campus" className="campus-image object-cover w-full h-full" />
                                <div className="image-overlay absolute bottom-0 left-0 right-0 bg-black/60 text-white p-2 text-sm font-medium">School Campus</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
