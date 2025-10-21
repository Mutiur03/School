/* eslint-disable no-unused-vars */
import React, { useEffect } from "react";
import { useState } from "react";
import { useAuth } from "../context/authContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import ThemeChange from "../components/ThemeChange";
function Login() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
      return;
    }
  }, [user, navigate]);

  if (user) {
    return null;
  }

  if (loading) {
    return null;
  }
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <Card className="shadow-2xl  relative rounded-2xl">
          <ThemeChange vars={"top-0 absolute right-0"} />

          <div>
            <CardContent className="p-6">
              <h2 className="text-2xl font-semibold text-center mb-6">
                Admin Login
              </h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await login(username, password);
                  navigate("/dashboard");
                }}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <label
                    htmlFor=""
                    className="text-sm font-medium text-popover-foreground"
                  >
                    Username
                  </label>
                  <input
                    type="text"
                    placeholder="Enter your Username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
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
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    placeholder="Enter your password"
                    name="password"
                    required
                    className="w-full px-4 py-2 border border-border rounded-lg bg-popover text-popover-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <Button className="w-full">Login</Button>
              </form>
            </CardContent>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

export default Login;
