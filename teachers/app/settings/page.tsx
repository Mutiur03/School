"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import axios from "axios";

type FormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export default function ChangePassword() {
  const [form, setForm] = useState<FormState>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const { currentPassword, newPassword, confirmPassword } = form;
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    try {
      const res = await axios.post("/api/teachers/change-password", {
        currentPassword,
        newPassword,
      });
      if (res.data?.success) {
        setSuccess("Password changed successfully");
        setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      } else {
        setError(res.data?.message || "Failed to change password");
      }
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null) {
        const errorObj = err as { response?: { data?: { error?: string } }, message?: string };
        setError(
          errorObj?.response?.data?.error ||
          errorObj?.message ||
          "Something went wrong"
        );
      } else {
        setError("Something went wrong");
      }
    }
  };

  return (
    <div className="flex  justify-center items-center px-4">
      <Card className="w-full my-4 sm:my-12 mx-auto max-w-md shadow-xl rounded-2xl border">
        <form
          onSubmit={handleSubmit}
          className="space-y-5 p-6"
          autoComplete="off"
        >
          <h2 className="text-2xl font-semibold text-center mb-6">
            Change Password
          </h2>
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <div className="relative">
              <input
                id="currentPassword"
                name="currentPassword"
                type={showCurrent ? "text" : "password"}
                value={form.currentPassword}
                onChange={handleChange}
                required
                autoComplete="current-password"
                className="w-full px-4 py-2 border rounded-lg bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <button
                type="button"
                className="absolute right-2 top-2 text-xs px-2 py-1 rounded bg-muted"
                onClick={() => setShowCurrent((v) => !v)}
                tabIndex={-1}
              >
                {showCurrent ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <div className="relative">
              <input
                id="newPassword"
                name="newPassword"
                type={showNew ? "text" : "password"}
                value={form.newPassword}
                onChange={handleChange}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full px-4 py-2 border rounded-lg bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <button
                type="button"
                className="absolute right-2 top-2 text-xs px-2 py-1 rounded bg-muted"
                onClick={() => setShowNew((v) => !v)}
                tabIndex={-1}
              >
                {showNew ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <div className="relative">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirm ? "text" : "password"}
                value={form.confirmPassword}
                onChange={handleChange}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full px-4 py-2 border rounded-lg bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <button
                type="button"
                className="absolute right-2 top-2 text-xs px-2 py-1 rounded bg-muted"
                onClick={() => setShowConfirm((v) => !v)}
                tabIndex={-1}
              >
                {showConfirm ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          {error && (
            <div className="text-red-600 text-sm" role="alert">
              {error}
            </div>
          )}
          {success && (
            <div className="text-green-600 text-sm" role="status">
              {success}
            </div>
          )}
          <Button type="submit" className="w-full mt-2">
            Update Password
          </Button>
        </form>
      </Card>
    </div>
  );
}
