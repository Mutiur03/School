import axios from "axios";
import { Mail, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion"; // Import framer-motion for animations

type Teacher = {
    id: number;
    name: string;
    designation: string;
    subject: string;
    academic_qualification: string;
    email: string;
    phone: string;
    image: string;
};

export default function TeachersPage() {
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTeachers = async () => {
        try {
            const response = await axios.get("/api/teachers/getTeachers");
            const data = await response.data.data;
            setTeachers(data || []); // Ensure data is an array
            setLoading(false);
        } catch (error) {
            console.error("Error fetching teachers:", error);
            setTeachers([]); // Fallback to an empty array on error
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTeachers();
    }, []);

    const host = import.meta.env.VITE_BACKEND_URL;

    return (
        <div className="py-12">
            <div className="container-custom">
                <h1 className="section-title">Our Teachers</h1>

                <p className="max-w-3xl mb-8 text-gray-600 mx-auto">
                    Our dedicated team of teachers is committed to providing quality education and guidance to our students. They
                    bring a wealth of knowledge, experience, and passion to the classroom.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading
                        ? Array.from({ length: 6 }).map((_, index) => (
                              <div
                                  key={index}
                                  className="bg-gray-200 animate-pulse rounded-lg shadow-md overflow-hidden h-80"
                              ></div>
                          ))
                        : teachers.map((teacher) => (
                              <motion.div
                                  key={teacher.id}
                                  className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                                  initial={{ opacity: 0, y: 50 }}
                                  whileInView={{ opacity: 1, y: 0 }}
                                  viewport={{ once: true }}
                                  transition={{ duration: 0.5 }}
                              >
                                  <div className="relative h-64">
                                      <img
                                          src={teacher.image ? `${host}/${teacher.image}` : "/placeholder.svg"}
                                          alt={teacher.name}
                                          className="object-cover w-full h-full"
                                      />
                                  </div>
                                  <div className="p-4">
                                      <h3 className="font-bold text-xl text-primary">{teacher.name}</h3>
                                      <p className="text-gray-700 font-medium">{teacher.designation}</p>
                                      <p className="text-gray-600 mb-2">Subject: {teacher.subject}</p>
                                      <p className="text-gray-600 mb-4">
                                          Qualification:{" "}
                                          {teacher.academic_qualification.length > 50
                                              ? teacher.academic_qualification.slice(0, 50) + "..."
                                              : teacher.academic_qualification}
                                      </p>

                                      <div className="flex items-center justify-center gap-2 text-gray-600 mb-2">
                                          <Mail size={16} className="text-primary" />
                                          <span>{teacher.email}</span>
                                      </div>
                                      <div className="flex items-center justify-center gap-2 text-gray-600">
                                          <Phone size={16} className="text-primary" />
                                          <span>{teacher.phone}</span>
                                      </div>
                                  </div>
                              </motion.div>
                          ))}
                </div>
            </div>
        </div>
    );
}
