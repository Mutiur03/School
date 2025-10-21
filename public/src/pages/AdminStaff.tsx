"use client"
import { Mail, Phone } from "lucide-react";

// Typical high school non-teaching staff composition:
// - Administrative Staff: 2-4
// - Librarian: 1
// - Lab Assistant: 1-2
// - Support Staff (Peon, Cleaner, Guard): 3-5

const staff = [
    {
        id: 1,
        name: "Mr. Aminul Islam",
        designation: "Administrative Officer",
        department: "Administration",
        qualification: "B.A. in Management",
        email: "admin@panchbibilbp.edu.bd",
        phone: "+880 1234-567896",
        image: "/placeholder.svg?height=300&width=300",
    },
    {
        id: 2,
        name: "Mrs. Shirin Akter",
        designation: "Librarian",
        department: "Library",
        qualification: "M.A. in Library Science",
        email: "library@panchbibilbp.edu.bd",
        phone: "+880 1234-567897",
        image: "/placeholder.svg?height=300&width=300",
    },
    {
        id: 3,
        name: "Mr. Habib Rahman",
        designation: "Lab Assistant",
        department: "Science Lab",
        qualification: "B.Sc. in Chemistry",
        email: "lab@panchbibilbp.edu.bd",
        phone: "+880 1234-567898",
        image: "/placeholder.svg?height=300&width=300",
    },
    {
        id: 4,
        name: "Mr. Jalal Uddin",
        designation: "Peon",
        department: "Support",
        qualification: "S.S.C.",
        email: "peon@panchbibilbp.edu.bd",
        phone: "+880 1234-567899",
        image: "/placeholder.svg?height=300&width=300",
    },
    {
        id: 5,
        name: "Mrs. Rina Begum",
        designation: "Cleaner",
        department: "Support",
        qualification: "S.S.C.",
        email: "cleaner@panchbibilbp.edu.bd",
        phone: "+880 1234-567900",
        image: "/placeholder.svg?height=300&width=300",
    },
    {
        id: 6,
        name: "Mr. Shahin Alam",
        designation: "Guard",
        department: "Support",
        qualification: "S.S.C.",
        email: "guard@panchbibilbp.edu.bd",
        phone: "+880 1234-567901",
        image: "/placeholder.svg?height=300&width=300",
    },
];

export default function StaffPage() {
    return (
        <div className="py-12">
            <div className="container-custom">
                <h1 className="section-title">Our Non-Teaching Staff</h1>

                <p className="max-w-3xl mb-8">
                    Our non-teaching staff play a vital role in the smooth operation of
                    the school, supporting administration, library, laboratory, and campus
                    maintenance. A typical high school requires a dedicated team of
                    administrative and support personnel.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {staff.map((member) => (
                        <div
                            key={member.id}
                            className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                        >
                            <div className="relative h-64">
                                <img
                                    src={member.image || "/placeholder.svg"}
                                    alt={member.name}
                                    
                                    className="object-cover w-full h-full"
                                />
                            </div>
                            <div className="p-4">
                                <h3 className="font-bold text-xl text-primary">
                                    {member.name}
                                </h3>
                                <p className="text-gray-700 font-medium">
                                    {member.designation}
                                </p>
                                <p className="text-gray-600 mb-2">
                                    Department: {member.department}
                                </p>
                                <p className="text-gray-600 mb-4">
                                    Qualification: {member.qualification}
                                </p>
                                <div className="flex items-center gap-2 text-gray-600 mb-2">
                                    <Mail size={16} className="text-primary" />
                                    <span>{member.email}</span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-600">
                                    <Phone size={16} className="text-primary" />
                                    <span>{member.phone}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
