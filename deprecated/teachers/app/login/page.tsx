"use client";
import React, {  useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import axios, { isAxiosError } from "axios";
import ThemeChange from "@/components/ThemeChange";
import { toast } from "@/hooks/use-toast";
import {  useRouter } from "next/navigation";
import { useAuth } from "@/context/authContext"; // Import provider
export default function Login() {
    const {  loading, checkAuth } = useAuth();
    const [form, setForm] = useState({ email: "", password: "" }); // changed from login_id to email
    const [error, setError] = useState("");
    const [isLoggingIn, setIsLoggingIn] = useState(false); // new state
    const router = useRouter();
    // useEffect(() => {
    //     if (teacher) router.push("/");
    // }, [teacher]);

    // Prevent rendering login form while logging in
    if ( loading || isLoggingIn) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="rounded-lg shadow-lg p-8 w-96">
                    <h2 className="text-2xl font-bold mb-6 text-center">
                        {isLoggingIn ? "Logging in..." : "Loading..."}
                    </h2>
                </div>
            </div>
        );
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        setError("");
    };

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoggingIn(true); // <-- Set logging in state
        const formElement = e.currentTarget;
        const formData = {
            email: formElement.email.value, // changed from login_id to email
            password: formElement.password.value,
        };
        try {
            await axios.post(
                "/api/auth/teacher_login",
                formData,
                {
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
            await checkAuth(); // ensure context updates before redirect
            router.push("/");
            toast({
                title: "Login Successful",
                description: "Welcome back!",
                variant: "default",
            });
        } catch (error: unknown) {
            setIsLoggingIn(false); // <-- Reset logging in state on error
            let message = "Login failed";
            if (isAxiosError(error) && error.response?.data?.message) {
                message = error.response.data.message;
            }

            formElement.reset();
            setError(message);
            toast({
                title: "Login Failed",
                description: message || "Please try again.",
                variant: "destructive",
            });
        }

    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full max-w-md"
            >
                <Card className="shadow-2xl relative rounded-2xl">
                    <ThemeChange vars={" top-0 absolute right-0"}/>
                    <CardContent className="p-6">
                        <h2 className="text-2xl font-semibold text-center mb-6">
                            Teacher Login
                        </h2>
                        <form
                            onSubmit={handleLogin}
                            className="space-y-4"
                            autoComplete="off"
                        >
                            <div className="space-y-1">
                                <label
                                    htmlFor="email"
                                    className="text-sm font-medium text-popover-foreground"
                                >
                                    Email
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    name="email"
                                    value={form.email}
                                    onChange={handleChange}
                                    required
                                    autoComplete="email"
                                    placeholder="Enter your email"
                                    className="w-full px-4 py-2 border border-border rounded-lg bg-popover text-popover-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                />
                            </div>
                            <div className="space-y-1">
                                <label
                                    htmlFor="password"
                                    className="text-sm font-medium text-popover-foreground"
                                >
                                    Password
                                </label>
                                <input
                                    id="password"
                                    type="password"
                                    name="password"
                                    value={form.password}
                                    onChange={handleChange}
                                    required
                                    autoComplete="current-password"
                                    placeholder="Enter your password"
                                    className="w-full px-4 py-2 border border-border rounded-lg bg-popover text-popover-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                />
                            </div>
                            {error && <div className="text-red-600 text-sm">{error}</div>}
                            <Button type="submit" className="w-full">
                                Login
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
