/* eslint-disable no-unused-vars */
import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import axios from "axios";
import ThemeChange from "../components/ThemeChange";
import { useAuth } from "../context/appContext";
export default function Login() {
  const { user, loading, checkAuth,fetchingdata } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);
  if (user) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className=" rounded-lg shadow-lg p-8 w-96">
          <h2 className="text-2xl font-bold  mb-6 text-center">Loading...</h2>
        </div>
      </div>
    );
  }
  const handleLogin = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(e.currentTarget);
    try {
      axios.defaults.withCredentials = true;
      const response = await axios.post(
        "/api/auth/student_login",
        formData,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      checkAuth();
      toast.success(response.data.message);
    //   console.log(response.data);
      navigate("/");
    } catch (error) {
        form.reset();
      toast.error(error.response?.data?.message || "Login failed");
      console.log(error.response.data);
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
          <ThemeChange />
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold text-center mb-6">
              Student Login
            </h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1">
                <label
                  htmlFor="login_id"
                  className="text-sm font-medium text-popover-foreground"
                >
                  Login ID
                </label>
                <input
                  id="login_id"
                  type="text"
                  placeholder="Enter your Login ID"
                  minLength={5}
                  maxLength={5}
                  name="login_id"
                  required
                  className="w-full px-4 py-2 border border-border rounded-lg bg-popover text-popover-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent "
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
                  placeholder="Enter your password"
                  name="password"
                  required
                  className="w-full px-4 py-2 border border-border rounded-lg bg-popover text-popover-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent "
                />
              </div>
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
