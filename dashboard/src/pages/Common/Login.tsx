import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/useAuth";
import envPreferredRole from "@/lib/role";
import { Input } from "@/components/ui/input";
import axios from "axios";
import backend from "@/lib/backend";

type UserRole = "admin" | "teacher" | "student";

function Login() {
  const { loginAdmin, user, loading, isAdmin, isTeacher, isStudent, loginStudent, loginTeacher } = useAuth();
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
      setResetError(error.response?.data?.message || "Network error. Please try again.");
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
        ? "/api/auth/student/password-reset/verify"
        : "/api/auth/teacher/password-reset/verify";
      
      const payload = role === "student" 
        ? { login_id: resetLoginID, code: code, newPassword: "" }
        : { email: resetEmail, code: code, newPassword: "" };

      const response = await axios.post(endpoint, payload);

      if (response.data.success) {
        setResetMessage("Code verified successfully! Please set your new password.");
        setResetStep("newPassword");
      } else {
        setResetError(response.data.message || "Invalid verification code");
      }
    } catch (error: any) {
      setResetError(error.response?.data?.message || "Network error. Please try again.");
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
        ? `${backend}/api/auth/student/password-reset/verify`
        : `${backend}/api/auth/teacher/password-reset/verify`;
      
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
          setResetCode(["", "", "", "", "", "", ""]);
          setNewPassword("");
          setConfirmPassword("");
        }, 2000);
      } else {
        setResetError(response.data.message || "Failed to reset password");
      }
    } catch (error: any) {
      setResetError(error.response?.data?.message || "Network error. Please try again.");
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

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !resetCode[index] && index > 0) {
      codeInputRefs[index - 1].current?.focus();
    }
  };

  if (user) {
    // Only return null (hididng the login page) if the current user is allowed to be here
    if (isAdmin() && (!envPreferredRole || envPreferredRole === 'admin')) return null;
    if (isTeacher() && (!envPreferredRole || envPreferredRole === 'teacher')) return null;
    if (isStudent() && (!envPreferredRole || envPreferredRole === 'student')) return null;
  }

  if (loading) {
    return null;
  }
  return (
    <div className="min-h-screen flex items-center justify-center px-4 ">
      <div className="w-full max-w-md">
        <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
          <CardContent className="p-8">
            <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
              {showPasswordReset 
                ? "Reset Password" 
                : `${role.charAt(0).toUpperCase() + role.slice(1)} Login`
              }
            </h2>

            {showPasswordReset && (
              <div className="text-center mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-center justify-center mb-2">
                  <svg className="w-6 h-6 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2h2v-2l2.257-3.257A6 6 0 0119 9z" />
                  </svg>
                  <span className="text-sm font-medium text-blue-800">Password Reset</span>
                </div>
                <p className="text-sm text-blue-700">
                  Enter your {role === "student" ? "Login ID" : "email address"} and we'll send you a code to reset your password.
                </p>
              </div>
            )}

            {showPasswordReset ? (
              // Password Reset Form
              <div className="space-y-5">
                {resetMessage && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm text-green-800">{resetMessage}</span>
                    </div>
                  </div>
                )}
                
                {resetError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm text-red-800">{resetError}</span>
                    </div>
                  </div>
                )}

                {resetStep === "request" ? (
                  <form onSubmit={handlePasswordResetRequest} className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700 flex items-center">
                        {role === "student" ? (
                          <>
                            <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Login ID
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            Email
                          </>
                        )}
                      </label>
                      {role === "student" ? (
                        <Input
                          type="text"
                          placeholder="Enter your 5-digit Login ID"
                          required
                          pattern="\d{5}"
                          title="Login ID must be exactly 5 digits"
                          maxLength={5}
                          minLength={5}
                          value={resetLoginID}
                          onChange={(e) => setResetLoginID(e.target.value)}
                          className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-lg"
                        />
                      ) : (
                        <Input
                          type="email"
                          placeholder="Enter your email address"
                          required
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-lg"
                        />
                      )}
                    </div>
                    <Button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors" disabled={isResetting}>
                      {isResetting ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Sending...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                          Send Reset Code
                        </>
                      )}
                    </Button>
                    <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 flex items-center justify-center">
                        <svg className="w-4 h-4 mr-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Check your {role === "student" ? "phone" : "email"} for reset code
                      </p>
                    </div>
                  </form>
                ) : resetStep === "verify" ? (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700 flex items-center">
                        <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Enter verification code
                      </label>
                      <p className="text-xs text-gray-500 mb-2">
                        We sent a 6-digit code to your {role === "student" ? "phone number" : "email address"}
                      </p>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3">
                        <p className="text-sm text-gray-600">
                          Code sent {role === "student" ? "for Login ID" : "to email"}: <span className="font-medium text-gray-800">
                            {role === "student" 
                              ? resetLoginID 
                              : resetEmail
                            }
                          </span>
                        </p>
                      </div>
                      <div className="flex justify-center space-x-3">
                        {resetCode.map((digit, index) => (
                          <Input
                            key={index}
                            ref={codeInputRefs[index]}
                            type="text"
                            maxLength={1}
                            className="w-14 h-14 text-center text-lg font-mono border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-lg text-center"
                            value={digit}
                            onChange={(e) => handleCodeChange(index, e.target.value)}
                            onKeyDown={(e) => handleCodeKeyDown(index, e)}
                          />
                        ))}
                      </div>
                    </div>
                    <Button 
                      onClick={handleCodeVerify} 
                      className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors" 
                      disabled={isResetting || resetCode.join("").length !== 6}
                    >
                      {isResetting ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Verifying...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Verify Code
                        </>
                      )}
                    </Button>
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={handlePasswordResetRequest}
                        disabled={isResetting}
                        className="text-sm text-blue-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      >
                        {isResetting ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-3 w-3" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Resending...
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Didn't receive code? Resend
                          </>
                        )}
                      </button>
                      <p className="text-xs text-gray-500 mt-2">
                        Code expires in 15 minutes
                      </p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handlePasswordResetVerify} className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700 flex items-center">
                        <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2h2v-2l2.257-3.257A6 6 0 0119 9z" />
                        </svg>
                        New Password
                      </label>
                      <Input
                        type="password"
                        placeholder="Create a strong password (min 8 characters)"
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-lg"
                      />
                      <p className="text-xs text-gray-500 ml-1">
                        Use 8+ characters, including uppercase, lowercase, and numbers
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700 flex items-center">
                        <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Confirm New Password
                      </label>
                      <Input
                        type="password"
                        placeholder="Confirm your new password"
                        required
                        minLength={8}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-lg"
                      />
                    </div>
                    <Button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors" disabled={isResetting}>
                      {isResetting ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Updating...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Update Password
                        </>
                      )}
                    </Button>
                  </form>
                )}

                <div className="text-center mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordReset(false);
                      setResetStep("request");
                      setResetEmail("");
                      setResetLoginID("");
                      setResetCode(["", "", "", "", "", "", ""]);
                      setNewPassword("");
                      setConfirmPassword("");
                      setResetMessage("");
                      setResetError("");
                    }}
                    className="text-sm text-blue-600 hover:underline flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
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
                className="space-y-5"
              >
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center">
                    {location.pathname.includes("/teacher") ? (
                      <>
                        <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Email
                      </>
                    ) : location.pathname.includes("/student") ? (
                      <>
                        <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Login ID
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Username
                      </>
                    )}
                  </label>
                  {location.pathname.includes("/teacher") ? (
                    <Input
                      type="email"
                      placeholder="Enter your email address"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-lg"
                    />
                  ) : location.pathname.includes("/student") ? (
                    <Input
                      type="text"
                      placeholder="Enter your 5-digit Login ID"
                      required
                      pattern="\d{5}"
                      title="Login ID must be exactly 5 digits"
                      maxLength={5}
                      minLength={5}
                      value={loginID}
                      onChange={(e) => setLoginID(e.target.value)}
                      className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-lg"
                    />
                  ) : (
                    <Input
                      type="text"
                      placeholder="Enter your username"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-lg"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center">
                    <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2h2v-2l2.257-3.257A6 6 0 0119 9z" />
                    </svg>
                    Password
                  </label>
                  <Input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    placeholder="Enter your password"
                    name="password"
                    required
                    className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-lg"
                  />
                </div>
                {!showPasswordReset && (location.pathname.includes("/teacher") || location.pathname.includes("/student")) && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setShowPasswordReset(true)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}
                <Button className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">Login</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Login;
