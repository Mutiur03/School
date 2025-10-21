import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Eye, EyeOff } from "lucide-react";
import axios from "axios";

const ChangePasswordPage = () => {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // State for password visibility
  const [show, setShow] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { currentPassword, newPassword, confirmPassword } = form;

    if (newPassword !== confirmPassword) {
      return setError("New passwords do not match");
    }

    try {
      const res = await axios.post("/api/students/change-password", {
        currentPassword,
        newPassword,
      });

      if (res.data.success) {
        setError("");
        setSuccess("Password changed successfully");
        setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      } else {
        setError(res.data.message || "Failed to change password");
      }
    } catch (err) {
      console.log(err);

      setError(err.response?.data?.error || "Something went wrong");
    }
  };

  return (
    <div className="flex justify-center items-center px-4">
      <Card className="w-full max-w-md shadow-xl rounded-2xl border ">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <input
                  id="currentPassword"
                  name="currentPassword"
                  type={show.current ? "text" : "password"}
                  value={form.currentPassword}
                  onChange={handleChange}
                  required
                  placeholder="Enter your current password"
                  className="w-full px-4 py-2 border rounded-lg bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                  onClick={() =>
                    setShow((prev) => ({ ...prev, current: !prev.current }))
                  }
                  aria-label={show.current ? "Hide password" : "Show password"}
                >
                  {show.current ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <input
                  id="newPassword"
                  name="newPassword"
                  type={show.new ? "text" : "password"}
                  value={form.newPassword}
                  onChange={handleChange}
                  required
                  minLength={8}
                  // pattern="^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$"
                  // title="Password must be at least 8 characters long and contain at least one letter and one number."
                  placeholder="Enter your new password"
                  className="w-full px-4 py-2 border  rounded-lg bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                  onClick={() =>
                    setShow((prev) => ({ ...prev, new: !prev.new }))
                  }
                  aria-label={show.new ? "Hide password" : "Show password"}
                >
                  {show.new ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={show.confirm ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={handleChange}
                  required
                  minLength={8}
                  // pattern="^(?=.*[A-Za-z])(?=.*\d)[A-ZaZ\d]{8,}$"
                  // title="Password must be at least 8 characters long and contain at least one letter and one number."
                  placeholder="Confirm your new password"
                  className="w-full px-4 py-2 border rounded-lg bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                  onClick={() =>
                    setShow((prev) => ({ ...prev, confirm: !prev.confirm }))
                  }
                  aria-label={show.confirm ? "Hide password" : "Show password"}
                >
                  {show.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-5 w-5" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="mt-2 border-green-300 bg-green-50">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full mt-2">
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChangePasswordPage;
