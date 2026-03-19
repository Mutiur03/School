import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/useAuth";
import envPreferredRole from "@/lib/role";
import { Input } from "@/components/ui/input";
import axios from "axios";
import { getErrorMessage } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";

type UserRole = "admin" | "teacher" | "student";

function Login() {
  const { loginAdmin, user, isAdmin, isTeacher, isStudent, loginStudent, loginTeacher } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginID, setLoginID] = useState("");
  const [email, setEmail] = useState("");
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoginID, setResetLoginID] = useState("");
  const [resetCode, setResetCode] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [resetStep, setResetStep] = useState<"request" | "verify" | "newPassword">("request");
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const codeInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const role: UserRole = location.pathname.includes("/teacher") ? "teacher" : location.pathname.includes("/student") ? "student" : "admin";

  useEffect(() => {
    if (user) {
      if (isAdmin() && (!envPreferredRole || envPreferredRole === 'admin')) navigate("/admin/dashboard");
      else if (isTeacher() && (!envPreferredRole || envPreferredRole === 'teacher')) navigate("/teacher/dashboard");
      else if (isStudent() && (!envPreferredRole || envPreferredRole === 'student')) navigate("/student/dashboard");
      return;
    }
  }, [user, isAdmin, isTeacher, isStudent, navigate]);

  useEffect(() => {
    document.title = `${role.charAt(0).toUpperCase() + role.slice(1)} Login`;
    setLoginError("");
  }, [role]);

  const handlePasswordResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetting(true);
    setResetError("");
    setResetMessage("");

    try {
      const endpoint = role === "student"
        ? "/api/auth/student/password-reset/request"
        : "/api/auth/teacher/password-reset/request";

      const payload = role === "student"
        ? { login_id: resetLoginID }
        : { email: resetEmail };

      const response = await axios.post(endpoint, payload);

      if (response.data.success) {
        setResetMessage(response.data.data?.message || "Reset code sent to your email/phone.");
        setResetStep("verify");
      } else {
        setResetError(response.data.message || "Failed to send reset code");
      }
    } catch (error: any) {
      setResetError(getErrorMessage(error));
    } finally {
      setIsResetting(false);
    }
  };

  const handleCodeVerify = async () => {
    const code = resetCode.join("");
    if (code.length !== 6) {
      setResetError("Please enter all 6 digits");
      return;
    }

    setIsResetting(true);
    setResetError("");
    setResetMessage("");

    try {
      const endpoint = role === "student"
        ? "/api/auth/student/password-reset/check-code"
        : "/api/auth/teacher/password-reset/check-code";

      const payload = role === "student"
        ? { login_id: resetLoginID, code: code }
        : { email: resetEmail, code: code };

      const response = await axios.post(endpoint, payload);

      if (response.data.success) {
        setResetMessage("Code verified successfully! Please set your new password.");
        setResetStep("newPassword");
      } else {
        setResetError(response.data.message || "Invalid verification code");
      }
    } catch (error: any) {
      setResetError(getErrorMessage(error));
    } finally {
      setIsResetting(false);
    }
  };

  const handlePasswordResetVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setResetError("Password must be at least 8 characters long");
      return;
    }

    setIsResetting(true);
    setResetError("");
    setResetMessage("");

    try {
      const endpoint = role === "student"
        ? "/api/auth/student/password-reset/verify"
        : "/api/auth/teacher/password-reset/verify";

      const payload = role === "student"
        ? { login_id: resetLoginID, code: resetCode.join(""), newPassword: newPassword }
        : { email: resetEmail, code: resetCode.join(""), newPassword: newPassword };

      const response = await axios.post(endpoint, payload);

      if (response.data.success) {
        setResetMessage("Password reset successfully! You can now login with your new password.");
        setTimeout(() => {
          setShowPasswordReset(false);
          setResetStep("request");
          setResetEmail("");
          setResetLoginID("");
          setResetCode(["", "", "", "", "", ""]);
          setNewPassword("");
          setConfirmPassword("");
          setResetError("");
          setResetMessage("");
        }, 2000);
      } else {
        setResetError(response.data.message || "Failed to reset password");
      }
    } catch (error: any) {
      setResetError(getErrorMessage(error));
    } finally {
      setIsResetting(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    const newCode = [...resetCode];
    newCode[index] = value;
    setResetCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      codeInputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Backspace to focus previous input
    if (e.key === "Backspace" && !resetCode[index] && index > 0) {
      codeInputRefs[index - 1].current?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    const digitsOnly = pastedData.replace(/\D/g, "").slice(0, 6);

    if (digitsOnly.length > 0) {
      const newCode = [...resetCode];
      digitsOnly.split("").forEach((digit, i) => {
        if (i < 6) newCode[i] = digit;
      });
      setResetCode(newCode);

      // Focus the next empty or last filled input
      const nextIndex = Math.min(digitsOnly.length, 5);
      codeInputRefs[nextIndex].current?.focus();
    }
  };

  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center p-4 transition-colors duration-500 overflow-hidden text-foreground">
      {/* Decorative Background Blobs mapping to brand palette */}
      <div className="absolute top-[-15%] left-[-15%] w-[50%] h-[50%] bg-primary/20 dark:bg-primary/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[10s]"></div>
      <div className="absolute bottom-[-15%] right-[-15%] w-[50%] h-[50%] bg-secondary/20 dark:bg-secondary/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[8s]"></div>

      <div className="relative w-full max-w-md z-10">
        <div className="text-center mb-10 animate-in fade-in slide-in-from-top duration-1000">
          <h1 className="text-5xl sm:text-6xl font-black mb-3 tracking-tighter">
            <span className="bg-clip-text text-transparent bg-gradient-to-br from-primary via-primary/80 to-secondary dark:from-primary dark:via-primary/70 dark:to-secondary">
              School Sync
            </span>
          </h1>
          <div className="h-1.5 w-16 bg-gradient-to-r from-primary to-secondary mx-auto rounded-full mb-4 shadow-[0_0_15px_rgba(15,23,42,0.2)]"></div>
          <p className="text-muted-foreground font-bold tracking-[0.2em] uppercase text-[10px] opacity-80">
            Professional Enterprise Intelligence
          </p>
        </div>

        <Card className="border border-white/40 dark:border-white/5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] bg-white/95 dark:bg-gray-900/90 backdrop-blur-3xl rounded-3xl overflow-hidden transition-all duration-500 border-b-primary/20">
          <CardContent className="pt-10 pb-8 px-6 sm:px-10">
            <div className="flex justify-center mb-8">
              <div className="flex p-1.5 bg-muted/80 dark:bg-slate-800/50 rounded-md w-full shadow-inner border border-border dark:border-slate-700/30">
                {!showPasswordReset ? (
                  envPreferredRole ? (<>
                    <button
                      // onClick={() => navigate("/admin/login")}
                      // className={`flex-1 py-3 text-sm font-black rounded-md transition-all duration-300 ${location.pathname.includes("/admin")
                      //   ? "bg-primary text-white shadow-lg shadow-primary/30 scale-[1.02]"
                      //   : "text-muted-foreground hover:text-primary dark:hover:text-primary hover:bg-white/60 dark:hover:bg-slate-700/50"
                      //   }`}
                      className="flex-1 py-3 text-sm font-black rounded-md transition-all duration-300 text-muted-foreground hover:text-primary dark:hover:text-primary hover:bg-white/60 dark:hover:bg-slate-700/50"
                    >
                      {/* Admin */}
                    </button>
                    <button
                      // onClick={() => navigate("/teacher/login")}
                      // className={`flex-1 py-3 text-sm font-black rounded-md transition-all duration-300 ${location.pathname.includes("/teacher")
                      //   ? "bg-primary text-white shadow-lg shadow-primary/30 scale-[1.02]"
                      //   : "text-muted-foreground hover:text-primary dark:hover:text-primary hover:bg-white/60 dark:hover:bg-slate-700/50"
                      //   }`}
                      className="flex-1 py-3 text-sm font-black rounded-md transition-all duration-300 bg-primary text-white shadow-lg shadow-primary/30 scale-[1.02]"

                    >
                      {/* Teacher */}
                      {location.pathname.startsWith("/admin") && "Admin"}
                      {location.pathname.startsWith("/teacher") && "Teacher"}
                      {location.pathname.startsWith("/student") && "Student"}
                    </button>
                    <button
                      // onClick={() => navigate("/student/login")}
                      // className={`flex-1 py-3 text-sm font-black rounded-md transition-all duration-300 ${location.pathname.includes("/student")
                      //   ? "bg-primary text-white shadow-lg shadow-primary/30 scale-[1.02]"
                      //   : "text-muted-foreground hover:text-primary dark:hover:text-primary hover:bg-white/60 dark:hover:bg-slate-700/50"
                      //   }`}
                      className="flex-1 py-3 text-sm font-black rounded-md transition-all duration-300 text-muted-foreground hover:text-primary dark:hover:text-primary hover:bg-white/60 dark:hover:bg-slate-700/50"

                    >
                      {/* Student */}
                    </button>

                  </>
                  ) : (<>
                    <button
                      onClick={() => navigate("/admin/login")}
                      className={`flex-1 py-3 text-sm font-black rounded-md transition-all duration-300 ${location.pathname.includes("/admin")
                        ? "bg-primary text-white shadow-lg shadow-primary/30 scale-[1.02]"
                        : "text-muted-foreground hover:text-primary dark:hover:text-primary hover:bg-white/60 dark:hover:bg-slate-700/50"
                        }`}
                    >
                      Admin
                    </button>
                    <button
                      onClick={() => navigate("/teacher/login")}
                      className={`flex-1 py-3 text-sm font-black rounded-md transition-all duration-300 ${location.pathname.includes("/teacher")
                        ? "bg-primary text-white shadow-lg shadow-primary/30 scale-[1.02]"
                        : "text-muted-foreground hover:text-primary dark:hover:text-primary hover:bg-white/60 dark:hover:bg-slate-700/50"
                        }`}
                    >
                      Teacher
                    </button>
                    <button
                      onClick={() => navigate("/student/login")}
                      className={`flex-1 py-3 text-sm font-black rounded-md transition-all duration-300 ${location.pathname.includes("/student")
                        ? "bg-primary text-white shadow-lg shadow-primary/30 scale-[1.02]"
                        : "text-muted-foreground hover:text-primary dark:hover:text-primary hover:bg-white/60 dark:hover:bg-slate-700/50"
                        }`}
                    >
                      Student
                    </button>
                  </>)
                ) : (
                  <div className="w-full py-3 text-center text-sm font-black text-primary dark:text-primary-foreground bg-white/50 dark:bg-slate-800/50 rounded-md shadow-sm border border-primary/10 dark:border-primary/20 tracking-wider">
                    RESETTING {role.toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            {showPasswordReset && (
              <div className="text-center mb-10 p-5 bg-primary/5 dark:bg-primary/10 rounded-md border border-primary/10 animate-in zoom-in-95 duration-500">
                <div className="flex items-center justify-center mb-3">
                  <div className="p-2 bg-primary/10 dark:bg-primary/20 rounded-full mr-3 shadow-sm border border-primary/10">
                    <svg className="w-5 h-5 text-primary dark:text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2h2v-2l2.257-3.257A6 6 0 0119 9z" />
                    </svg>
                  </div>
                  <span className="text-sm font-black text-primary dark:text-primary-foreground/90 uppercase tracking-widest">Verify Identity</span>
                </div>
                <p className="text-xs text-muted-foreground font-medium leading-relaxed max-w-[240px] mx-auto">
                  Enter your {role === "student" ? "Login ID" : "email address"} to receive a multi-factor verification code.
                </p>
              </div>
            )}

            {showPasswordReset ? (
              // Password Reset Form
              <div className="space-y-5">
                {resetMessage && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 rounded-md animate-in fade-in duration-500">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-medium text-green-800 dark:text-green-300">{resetMessage}</span>
                    </div>
                  </div>
                )}

                {resetError && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-md animate-in shake duration-500">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-medium text-red-800 dark:text-red-300">{resetError}</span>
                    </div>
                  </div>
                )}

                {resetStep === "request" ? (
                  <form onSubmit={handlePasswordResetRequest} className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-muted-foreground flex items-center uppercase tracking-widest">
                        {role === "student" ? (
                          <>
                            <svg className="w-4 h-4 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Login ID
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            Email
                          </>
                        )}
                      </label>
                      {role === "student" ? (
                        <Input
                          type="text"
                          placeholder="e.g., 10001"
                          required
                          value={resetLoginID}
                          onChange={(e) => setResetLoginID(e.target.value)}
                          className="h-12 border-border dark:border-border/50 bg-input focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-md transition-all"
                        />
                      ) : (
                        <Input
                          type="email"
                          placeholder="e.g., user@example.com"
                          required
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          className="h-12 border-border dark:border-border/50 bg-input focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-md transition-all"
                        />
                      )}
                    </div>
                    <Button
                      type="submit"
                      disabled={isResetting}
                      className="w-full h-12 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white font-black rounded-md shadow-lg shadow-primary/20 transition-all duration-300 transform active:scale-[0.98]"
                    >
                      {isResetting ? (
                        <div className="flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </div>
                      ) : "Send Reset Code"}
                    </Button>
                  </form>
                ) : resetStep === "verify" ? (
                  <div className="space-y-6">
                    <div className="flex justify-between gap-2 px-2" onPaste={handlePaste}>
                      {resetCode.map((digit, index) => (
                        <input
                          key={index}
                          ref={codeInputRefs[index]}
                          type="text"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleCodeChange(index, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(index, e)}
                          className="w-full h-14 text-center text-2xl font-black border-2 rounded-md border-border bg-input focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white shadow-sm"
                        />
                      ))}
                    </div>
                    <Button
                      onClick={handleCodeVerify}
                      disabled={isResetting}
                      className="w-full h-12 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white font-black rounded-md shadow-lg shadow-primary/20 transition-all duration-300 transform active:scale-[0.98]"
                    >
                      {isResetting ? "Verifying..." : "Verify Code"}
                    </Button>
                    <div className="text-center">
                      <button
                        onClick={() => setResetStep("request")}
                        className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest"
                      >
                        Resend Code
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handlePasswordResetVerify} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-muted-foreground flex items-center uppercase tracking-widest">New Password</label>
                      <div className="relative">
                        <Input
                          type={showNewPassword ? "text" : "password"}
                          placeholder="Minimum 8 characters"
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="h-12 border-border dark:border-border/50 bg-input focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-md pr-10 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary focus:outline-none transition-colors"
                        >
                          {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-muted-foreground flex items-center uppercase tracking-widest">Confirm Password</label>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm your new password"
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="h-12 border-border dark:border-border/50 bg-input focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-md pr-10 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary focus:outline-none transition-colors"
                        >
                          {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      disabled={isResetting}
                      className="w-full h-12 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white font-black rounded-md shadow-lg shadow-primary/20 transition-all duration-300 transform active:scale-[0.98]"
                    >
                      {isResetting ? (
                        "Updating..."
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Update Password</span>
                        </div>
                      )}
                    </Button>
                  </form>
                )}

                <div className="text-center mt-8">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordReset(false);
                      setResetStep("request");
                      setResetEmail("");
                      setResetLoginID("");
                      setResetCode(["", "", "", "", "", ""]);
                      setNewPassword("");
                      setConfirmPassword("");
                      setResetMessage("");
                      setResetError("");
                    }}
                    className="text-xs font-bold text-primary dark:text-primary hover:opacity-80 transition-colors flex items-center justify-center uppercase tracking-widest"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Login
                  </button>
                </div>
              </div>
            ) : (
              // Regular Login Form
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setLoginError("");

                  // Client-side validation
                  if (location.pathname.includes("/teacher")) {
                    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                    if (!emailRegex.test(email)) {
                      setLoginError("Please enter a valid email address.");
                      return;
                    }
                  } else if (location.pathname.includes("/student")) {
                    if (!/^\d{5}$/.test(loginID)) {
                      setLoginError("Student ID must be exactly 5 digits.");
                      return;
                    }
                  } else {
                    if (!username.trim()) {
                      setLoginError("Username is required.");
                      return;
                    }
                  }

                  try {
                    if (location.pathname.includes("/teacher")) {
                      await loginTeacher(email, password);
                    } else if (location.pathname.includes("/student")) {
                      await loginStudent(loginID, password);
                    } else {
                      await loginAdmin(username, password);
                    }
                    if (role === "admin") navigate("/admin/dashboard");
                    else if (role === "teacher") navigate("/teacher/dashboard");
                    else if (role === "student") navigate("/student/dashboard");
                  } catch {
                    // Error is already toasted inside the login functions
                  }
                }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <label className="text-xs font-black text-muted-foreground flex items-center uppercase tracking-widest">
                    {location.pathname.includes("/teacher") ? (
                      <>
                        <svg className="w-4 h-4 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Email Address
                      </>
                    ) : location.pathname.includes("/student") ? (
                      <>
                        <svg className="w-4 h-4 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Student ID
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Username
                      </>
                    )}
                  </label>
                  {location.pathname.includes("/teacher") ? (
                    <Input
                      type="email"
                      placeholder="e.g., teacher@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 border-border dark:border-border/50 bg-input focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-md transition-all"
                    />
                  ) : location.pathname.includes("/student") ? (
                    <Input
                      type="text"
                      placeholder="e.g., 10001"
                      required
                      pattern="\d{5}"
                      title="Login ID must be exactly 5 digits"
                      maxLength={5}
                      minLength={5}
                      value={loginID}
                      onChange={(e) => setLoginID(e.target.value)}
                      className="h-12 border-border dark:border-border/50 bg-input focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-md transition-all"
                    />
                  ) : (
                    <Input
                      type="text"
                      placeholder="e.g., admin_user"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="h-12 border-border dark:border-border/50 bg-input focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-md transition-all"
                    />
                  )}
                </div>
                {loginError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-md animate-in fade-in duration-300">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs font-medium text-red-800 dark:text-red-300">{loginError}</span>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-xs font-black text-muted-foreground flex items-center uppercase tracking-widest">
                    <svg className="w-4 h-4 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2h2v-2l2.257-3.257A6 6 0 0119 9z" />
                    </svg>
                    Secure Password
                  </label>
                  <div className="relative">
                    <Input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type={showLoginPassword ? "text" : "password"}
                      placeholder="••••••••"
                      name="password"
                      required
                      className="h-12 border-border dark:border-border/50 bg-input focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-md pr-10 transition-all dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors focus:outline-none"
                    >
                      {showLoginPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                {!showPasswordReset && (location.pathname.includes("/teacher") || location.pathname.includes("/student")) && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setShowPasswordReset(true)}
                      className="text-[10px] font-black text-primary hover:text-primary/80 transition-colors uppercase tracking-widest"
                    >
                      Forgot Access Details?
                    </button>
                  </div>
                )}
                <Button className="w-full h-12 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-primary-foreground font-black rounded-md shadow-lg shadow-primary/20 transition-all duration-300 transform active:scale-[0.98] flex items-center justify-center gap-2">
                  <span>Sign In</span>
                  <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Login;
