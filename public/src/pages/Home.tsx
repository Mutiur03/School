/* eslint-disable @typescript-eslint/no-unused-vars */
import Slider from "../components/Slider";
import { Calendar, BookOpen, Award, Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar as ShadCalendar } from "@/components/calendar";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import axios from "axios";
import { motion, useInView } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { useRef } from "react";
// Types
type Holiday = {
    id: number;
    title: string;
    start_date: string;
    end_date: string;
    description: string;
    is_optional: boolean;
};

type Events = {
    id: number;
    title: string;
    details: string;
    image: string;
    date: string;
};

type Notice = {
    id: number;
    title: string;
    details: string;
    image: string;
    created_at: string;
}

const sliderData = [
    {
        image: "/placeholder.svg?height=500&width=1200",
        title: "Welcome to Panchbibi LBP govt. High School",
        description:
            "Providing quality education and shaping the future of our nation since 1965.",
    },
    {
        image: "/placeholder.svg?height=500&width=1200",
        title: "Excellence in Education",
        description:
            "Committed to academic excellence and holistic development of students.",
    },
    {
        image: "/placeholder.svg?height=500&width=1200",
        title: "Building Future Leaders",
        description:
            "Nurturing young minds to become responsible citizens and future leaders.",
    },
];

const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

export default function Home() {
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [loading, setLoading] = useState(true);
    const [events, setEvents] = useState<Events[]>([]);
    const [notices, setNotices] = useState<Notice[]>([]);
    const ref = useRef(null);
    const inView = useInView(ref, { once: true });

    useEffect(() => {
        Promise.all([fetchNotices(), fetchEvents(), fetchHolidays()])
            .finally(() => setLoading(false));
    }, []);

    const host = import.meta.env.VITE_BACKEND_URL;
    const fetchNotices = async () => {
        try {
            const response = await axios.get("/api/notices/getNotices");
            console.log("notices", response.data);

            setNotices(response.data.data || []);
        } catch (error) {
            console.error("Error fetching notices:", error);
        }
    };

    const fetchEvents = async () => {
        try {
            const response = await axios.get("/api/events/getEvents");
            console.log(response.data);
            setEvents(response.data || []);
        } catch (error) {
            console.error("Error fetching notices:", error);
        }
    };

    const fetchHolidays = async () => {
        try {
            const res = await axios.get<Holiday[]>("/api/holidays/getHolidays");
            console.log(res.data);
            setHolidays(res.data);
        } catch (error) {
            console.error("Error fetching holidays:", error);
            setHolidays([]);
        }
    };

    const isHoliday = (date: Date): boolean => {
        const checkDate = new Date(date).setHours(0, 0, 0, 0);
        return holidays.some((h) => {
            const start = new Date(h.start_date).setHours(0, 0, 0, 0);
            const end = new Date(h.end_date).setHours(0, 0, 0, 0);
            return checkDate >= start && checkDate <= end;
        });
    };

    const getHolidaysForDate = (date: Date): Holiday[] => {
        const checkDate = date.setHours(0, 0, 0, 0);
        return holidays.filter((h) => {
            const start = new Date(h.start_date).setHours(0, 0, 0, 0);
            const end = new Date(h.end_date).setHours(0, 0, 0, 0);
            return checkDate >= start && checkDate <= end;
        });
    };

    return (
        <div>
            {/* Hero Slider */}
            <motion.div
                initial="hidden"
                animate="visible"
                variants={fadeIn}
            >
                <Slider slides={sliderData} />
            </motion.div>

            {/* Features Section */}
            <motion.section
                ref={ref}
                initial="hidden"
                animate={inView ? "visible" : "hidden"}
                variants={staggerContainer}
                className="py-12 bg-accent"
            >
                <div className="container-custom">
                    <motion.div
                        initial="hidden"
                        animate={loading ? "hidden" : "visible"}
                        variants={staggerContainer}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
                    >
                        {loading ? (
                            Array(4).fill(0).map((_, i) => (
                                <Skeleton key={i} className="h-48 w-full rounded-lg" />
                            ))
                        ) : (
                            <>
                                <motion.div variants={fadeIn} className="bg-white p-6 rounded-lg shadow-md text-center hover:shadow-lg transition-shadow">
                                    <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 text-primary rounded-full mb-4">
                                        <BookOpen size={32} />
                                    </div>
                                    <h3 className="text-xl font-bold mb-2">Quality Education</h3>
                                    <p className="text-gray-600">
                                        Providing high-quality education with modern teaching methods.
                                    </p>
                                </motion.div>

                                <motion.div variants={fadeIn} className="bg-white p-6 rounded-lg shadow-md text-center hover:shadow-lg transition-shadow">
                                    <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 text-primary rounded-full mb-4">
                                        <Award size={32} />
                                    </div>
                                    <h3 className="text-xl font-bold mb-2">Skilled Teachers</h3>
                                    <p className="text-gray-600">
                                        Our experienced teachers are dedicated to student success.
                                    </p>
                                </motion.div>

                                <motion.div variants={fadeIn} className="bg-white p-6 rounded-lg shadow-md text-center hover:shadow-lg transition-shadow">
                                    <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 text-primary rounded-full mb-4">
                                        <Calendar size={32} />
                                    </div>
                                    <h3 className="text-xl font-bold mb-2">Regular Activities</h3>
                                    <p className="text-gray-600">
                                        Various extracurricular activities for holistic development.
                                    </p>
                                </motion.div>

                                <motion.div variants={fadeIn} className="bg-white p-6 rounded-lg shadow-md text-center hover:shadow-lg transition-shadow">
                                    <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 text-primary rounded-full mb-4">
                                        <Bell size={32} />
                                    </div>
                                    <h3 className="text-xl font-bold mb-2">Modern Facilities</h3>
                                    <p className="text-gray-600">
                                        Well-equipped classrooms, library, and laboratories.
                                    </p>
                                </motion.div>
                            </>
                        )}
                    </motion.div>
                </div>
            </motion.section>

            {/* About Section */}
            <motion.section
                initial="hidden"
                animate="visible"
                variants={fadeIn}
                className="py-12"
            >
                <div className="container-custom">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                        {loading ? (
                            <>
                                <div className="space-y-4">
                                    <Skeleton className="h-8 w-3/4" />
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-5/6" />
                                    <Skeleton className="h-4 w-4/5" />
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-10 w-32 mt-4" />
                                </div>
                                <Skeleton className="h-[300px] rounded-lg" />
                            </>
                        ) : (
                            <>
                                <motion.div
                                    initial="hidden"
                                    animate="visible"
                                    variants={fadeIn}
                                >
                                    <h2 className="section-title">About Our School</h2>
                                    <p className="mb-4">
                                        Panchbibi LBP govt. High School, established in 1965, is one of
                                        the leading educational institutions in the region. The school
                                        has been providing quality education to students for decades.
                                    </p>
                                    <p className="mb-6">
                                        Our mission is to provide a holistic education that nurtures
                                        academic excellence, character development, and social
                                        responsibility in our students.
                                    </p>
                                    <Link to="/about/history" className="btn-primary">
                                        Learn More
                                    </Link>
                                </motion.div>
                                <motion.div
                                    initial="hidden"
                                    animate="visible"
                                    variants={fadeIn}
                                    className="relative h-[300px] rounded-lg overflow-hidden shadow-lg"
                                >
                                    <img
                                        src="/placeholder.svg?height=300&width=500"
                                        alt="School Building"
                                        className="object-cover w-full h-full"
                                    />
                                </motion.div>
                            </>
                        )}
                    </div>
                </div>
            </motion.section>

            {/* Notice and Events Section */}
            <motion.section
                initial="hidden"
                animate="visible"
                variants={staggerContainer}
                className="py-12 bg-gray-50"
            >
                <div className="container-custom">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Notices */}
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="section-title">Latest Notices</h2>
                                <Link to="/notice" className="text-primary hover:underline">
                                    View All
                                </Link>
                            </div>
                            {loading ? (
                                <div className="space-y-4">
                                    {Array(3).fill(0).map((_, i) => (
                                        <div key={i} className="bg-white p-4 rounded-lg shadow-md">
                                            <Skeleton className="h-6 w-3/4 mb-2" />
                                            <Skeleton className="h-4 w-1/4 mb-3" />
                                            <Skeleton className="h-4 w-full" />
                                            <Skeleton className="h-4 w-5/6 mt-1" />
                                            <Skeleton className="h-4 w-20 mt-2" />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <motion.div
                                    initial="hidden"
                                    animate="visible"
                                    variants={staggerContainer}
                                    className="bg-white rounded-lg shadow-md overflow-hidden"
                                >
                                    {notices.map((notice) => (
                                        <motion.div
                                            key={notice.id}
                                            variants={fadeIn}
                                            className="p-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="font-semibold text-lg">{notice.title}</h3>
                                                <span className="text-sm text-gray-500">
                                                    {format(new Date(notice.created_at), "MMM dd, yyyy")}
                                                </span>
                                            </div>
                                            <p className="text-gray-600 text-start">{notice.details}</p>
                                            <Link
                                                to={`/notice/${notice.id}`}
                                                className="text-primary text-sm hover:underline mt-2 inline-block"
                                            >
                                                Read More
                                            </Link>
                                        </motion.div>
                                    ))}
                                </motion.div>
                            )}
                        </div>

                        {/* Events */}
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="section-title">Upcoming Events</h2>
                                <Link to="/event" className="text-primary hover:underline">
                                    View All
                                </Link>
                            </div>
                            {loading ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {Array(2).fill(0).map((_, i) => (
                                        <div key={i} className="bg-white rounded-lg shadow-md overflow-hidden">
                                            <Skeleton className="h-40 w-full" />
                                            <div className="p-4">
                                                <Skeleton className="h-6 w-3/4 mb-2" />
                                                <Skeleton className="h-4 w-1/2 mb-3" />
                                                <Skeleton className="h-4 w-20" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <motion.div
                                    initial="hidden"
                                    animate="visible"
                                    variants={staggerContainer}
                                    className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                                >
                                    {events
                                        .filter((event) => new Date(event.date).setHours(0, 0, 0, 0) > new Date().setHours(0, 0, 0, 0))
                                        .map((event) => (
                                            <motion.div
                                                key={event.id}
                                                variants={fadeIn}
                                                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                                            >
                                                <div className="relative h-40">
                                                    <img
                                                        src={
                                                            event.image ? `${host}/${event.image}` : "/placeholder.svg"
                                                        }
                                                        alt={event.title}
                                                        className="object-cover w-full h-full"
                                                    />
                                                </div>
                                                <div className="p-4">
                                                    <h3 className="font-semibold text-lg mb-1">
                                                        {event.title}
                                                    </h3>
                                                    <p className="text-sm text-gray-500 mb-2">
                                                        {format(new Date(event.date), "dd MMM, yyyy")}
                                                    </p>
                                                    <Link
                                                        to={`/event/${event.id}`}
                                                        className="text-primary text-sm hover:underline"
                                                    >
                                                        View Details
                                                    </Link>
                                                </div>
                                            </motion.div>
                                        ))}
                                </motion.div>
                            )}
                        </div>
                    </div>
                </div>
            </motion.section>

            {/* Holiday Calendar Section */}
            <motion.section
                initial="hidden"
                animate="visible"
                variants={fadeIn}
                className="py-12 bg-white"
            >
                <div className="container-custom">
                    {loading ? (
                        <div className="flex flex-col lg:flex-row gap-8">
                            <div className="w-full lg:w-1/2 space-y-4">
                                <Skeleton className="h-8 w-1/2" />
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                                <Skeleton className="h-96 rounded-lg" />
                            </div>
                            <div className="w-full lg:w-1/2 space-y-4">
                                <Skeleton className="h-8 w-1/3" />
                                <Skeleton className="h-32 rounded-lg" />
                            </div>
                        </div>
                    ) : (
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            variants={fadeIn}
                            className="flex flex-col lg:flex-row gap-8"
                        >
                            {/* Calendar Section */}
                            <div className="w-full lg:w-1/2">
                                <h2 className="section-title flex items-center gap-2 mb-2">
                                    <CalendarIcon className="w-6 h-6" />
                                    Holiday Calendar
                                </h2>
                                <p className="text-gray-600 mb-2">
                                    Stay informed about upcoming school holidays throughout the year.
                                </p>
                                <p className="text-sm text-muted-foreground mb-4">
                                    (Select a date to view any holidays)
                                </p>
                                <div className="flex justify-center">
                                    <ShadCalendar
                                        onDateSelect={setSelectedDate}
                                        modifiers={{
                                            holiday: (date) => isHoliday(date),
                                        }}
                                        modifiersClassNames={{
                                            holiday: "bg-red-500 text-white hover:bg-red-600 hover:text-white",
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Holiday Details Section */}
                            <div className="w-full lg:w-1/2">
                                <h3 className="text-lg font-semibold mb-2">Holiday Details</h3>
                                {selectedDate ? (
                                    <div className="p-4 bg-gray-100 rounded-lg">
                                        <p className="text-gray-700">
                                            You selected: <strong>{format(selectedDate, "PPP")}</strong>
                                        </p>
                                        {getHolidaysForDate(selectedDate).length !== 0 ? (
                                            getHolidaysForDate(selectedDate).map((h) => (
                                                <div key={h.id} className="mt-2">
                                                    <p className="text-sm font-medium">
                                                        {h.title} ({format(new Date(h.start_date), "PPP")} -{" "}
                                                        {format(new Date(h.end_date), "PPP")}){h.is_optional && "*"}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">{h.description}</p>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-sm text-muted-foreground mt-2">
                                                No holidays on this date.
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        Please select a date to check holiday details.
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    )}
                </div>
            </motion.section>

            {/* Statistics Section */}
            <motion.section
                initial="hidden"
                animate="visible"
                variants={staggerContainer}
                className="py-12 bg-primary text-white"
            >
                <div className="container-custom">
                    {loading ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                            {Array(4).fill(0).map((_, i) => (
                                <div key={i}>
                                    <Skeleton className="h-12 w-20 mx-auto mb-2 bg-primary-foreground" />
                                    <Skeleton className="h-6 w-24 mx-auto bg-primary-foreground" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            variants={staggerContainer}
                            className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center"
                        >
                            <motion.div variants={fadeIn}>
                                <div className="text-4xl font-bold mb-2">1965</div>
                                <p className="text-lg">Established</p>
                            </motion.div>
                            <motion.div variants={fadeIn}>
                                <div className="text-4xl font-bold mb-2">1000+</div>
                                <p className="text-lg">Students</p>
                            </motion.div>
                            <motion.div variants={fadeIn}>
                                <div className="text-4xl font-bold mb-2">50+</div>
                                <p className="text-lg">Teachers</p>
                            </motion.div>
                            <motion.div variants={fadeIn}>
                                <div className="text-4xl font-bold mb-2">95%</div>
                                <p className="text-lg">Success Rate</p>
                            </motion.div>
                        </motion.div>
                    )}
                </div>
            </motion.section>
        </div>
    );
}