"use client";
import { useAuth } from "@/context/authContext";
import ThemeChange from "@/components/ThemeChange";
import Image from "next/image";
import { fixURL } from "@/lib/fixURL";
import { Menu } from "lucide-react"; // burger icon
import React, { forwardRef } from "react";
import LogoutConfirmation from "./LogOutConfirmation";

const Navbar = forwardRef<HTMLDivElement, { onBurgerClick?: () => void }>(
    function Navbar({ onBurgerClick }, ref) {
        const { logout } = useAuth();
        const { teacher } = useAuth();
        return (
            <nav
                ref={ref}
                className="navbar h-14 flex z-30 justify-between sticky top-0 w-full bg-sidebar border-b shadow-md px-5 items-center backdrop-blur-xl"
            >
                <div className="flex items-center gap-2">
                    <button
                        className="md:hidden mr-2 p-2 rounded focus:outline-none focus:ring-2 focus:ring-gray-400"
                        onClick={() => {
                            if (onBurgerClick) {
                                onBurgerClick();
                                console.log("Burger clicked");
                            }
                        }}
                        aria-label="Open sidebar"
                        type="button"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <h2>Teacher Dashboard</h2>
                </div>
                <div className="flex items-center gap-2 justify-between">
                    <span className="hidden md:block max-w-30 truncate"> {teacher?.name}</span>
                    {teacher?.image ? (
                        <div className="w-10 h-10 rounded-full border-4 border-gray-300 shadow-sm overflow-hidden">
                            <Image
                                src={fixURL(teacher.image)}
                                alt="Profile"
                                width={40}
                                height={40}
                                className="w-full h-full object-cover object-top"
                            />
                        </div>
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-xl">
                            {teacher?.name
                                ? teacher.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .toUpperCase()
                                : "👤"}
                        </div>
                    )}
                    <ThemeChange vars="" />
                    <LogoutConfirmation
                        onClick={logout}
                    />
                </div>
            </nav>
        );
    }
);

export default Navbar;

