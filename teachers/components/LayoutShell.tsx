'use client';

import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import React, { useEffect, useState } from "react";
import axios from "axios";
import LoadingScreen from "./LoadingScreen";

export default function ClientLayoutShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        axios.defaults.baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        axios.defaults.withCredentials = true;
    }, []);
    useEffect(() => {
        setMounted(true);
    }, []);
    if (pathname === "/login") {
        return <>{children}</>;
    }

    if (!mounted) {
        // Optionally show a loader here
        return <LoadingScreen />
    }

    return (
        <>
            <Navbar />
            <div className="flex min-h-[calc(100vh-3.5rem)]">
                <Sidebar>{children}</Sidebar>
            </div>
        </>
    );
}
