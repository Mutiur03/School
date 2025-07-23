"use client";
import { useAuth } from "@/context/authContext";
import ThemeChange from "@/components/ThemeChange";
import Image from "next/image";

export default function Navbar() {
    const { teacher } = useAuth();
    const host = process.env.NEXT_PUBLIC_BACKEND_URL;
    return (
        <nav className="navbar h-[3.5rem] flex z-30 justify-between sticky top-0 w-full bg-sidebar border-b shadow-md px-5 items-center backdrop-blur-xl">
            <h2>Teacher Dashboard</h2>
            <div className="mr-8 flex items-center gap-4">
                {teacher?.image ? (
                    <Image
                        src={`${host}/${teacher.image}`}
                        alt="Profile"
                        width={40}
                        height={40}
                        className="rounded-full border-4 border-gray-300 shadow-sm object-cover"
                    />
                ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-xl">👤</div>
                )}
                <span>{teacher?.name}</span>
                <ThemeChange />
            </div>
        </nav>
    );
}
