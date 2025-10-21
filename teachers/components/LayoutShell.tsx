'use client';

import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import LoadingScreen from "./LoadingScreen";

export default function ClientLayoutShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navbarRef = useRef<HTMLDivElement>(null);

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
        return <LoadingScreen />
    }

    // Sidebar is hidden on mobile unless open
    // Sidebar is always visible on md+ screens
    return (
        <>
            <Navbar
                ref={navbarRef}
                onBurgerClick={() => {
                    setSidebarOpen((prev) => !prev);
                    console.log("Sidebar open:", !sidebarOpen);
                }}
            />
            <Sidebar
                open={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                navbarRef={navbarRef}
            >
                {children}
            </Sidebar>
        </>
    );
}
