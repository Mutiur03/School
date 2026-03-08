import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/useAuth";
import envPreferredRole from "@/lib/role";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Card className="shadow-2xl">
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold text-center mb-6">
              {showPasswordReset 
                ? "Reset Password" 
                : `${role.charAt(0).toUpperCase() + role.slice(1)} Login`
              }
            </h2>

            {showPasswordReset ? (
              // Password Reset Form
              <div className="space-y-4">
                {resetMessage && (
                  <Alert className="bg-green-50 border-green-200">
                    <AlertDescription className="text-green-800">
                      {resetMessage}
                    </AlertDescription>
                  </Alert>
                )}
                
                {resetError && (
                  <Alert className="bg-red-50 border-red-200">
                    <AlertDescription className="text-red-800">
                      {resetError}
                    </AlertDescription>
                  </Alert>
                )}

                {resetStep === "request" ? (
                  <form onSubmit={handlePasswordResetRequest} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-popover-foreground">
                        {role === "student" ? "Login ID" : "Email"}
                      </label>
                      {role === "student" ? (
                        <Input
                          type="number"
                          placeholder="Enter your Login ID"
                          required
                          value={resetLoginID}
                          onChange={(e) => setResetLoginID(e.target.value)}
                        />
                      ) : (
                        <Input
                          type="email"
                          placeholder="Enter your email"
                          required
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                        />
                      )}
                    </div>
                    <Button type="submit" className="w-full" disabled={isResetting}>
                      {isResetting ? "Sending..." : "Send Reset Code"}
                    </Button>
                  </form>
                ) : resetStep === "verify" ? (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-popover-foreground">
                        Enter 6-digit verification code
                      </label>
                      <div className="flex justify-center space-x-2">
                        {resetCode.map((digit, index) => (
                          <Input
                            key={index}
                            ref={codeInputRefs[index]}
                            type="text"
                            maxLength={1}
                            className="w-12 h-12 text-center text-lg font-mono"
                            value={digit}
                            onChange={(e) => handleCodeChange(index, e.target.value)}
                            onKeyDown={(e) => handleCodeKeyDown(index, e)}
                          />
                        ))}
                      </div>
                    </div>
                    <Button 
                      onClick={handleCodeVerify} 
                      className="w-full" 
                      disabled={isResetting || resetCode.join("").length !== 6}
                    >
                      {isResetting ? "Verifying..." : "Verify Code"}
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handlePasswordResetVerify} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-popover-foreground">
                        New Password
                      </label>
                      <Input
                        type="password"
                        placeholder="Enter new password (min 8 characters)"
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-popover-foreground">
                        Confirm New Password
                      </label>
                      <Input
                        type="password"
                        placeholder="Confirm new password"
                        required
                        minLength={8}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isResetting}>
                      {isResetting ? "Resetting..." : "Reset Password"}
                    </Button>
                  </form>
                )}

                <div className="text-center">
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
                    className="text-sm text-blue-600 hover:underline"
                  >
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
                className="space-y-4"
              >
                <div className="space-y-1">
                  <label className="text-sm font-medium text-popover-foreground">
                    {location.pathname.includes("/teacher") ? "Email" : location.pathname.includes("/student") ? "Login ID" : "Username"}
                  </label>
                  {location.pathname.includes("/teacher") ? (
                    <Input
                      type="email"
                      placeholder="Enter your Email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  ) : location.pathname.includes("/student") ? (
                    <Input
                      type="number"
                      placeholder="Enter your Login ID"
                      required
                      value={loginID}
                      onChange={(e) => setLoginID(e.target.value)}
                    />
                  ) : (
                    <Input
                      type="text"
                      placeholder="Enter your Username"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  )}
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="password"
                    className="text-sm font-medium text-popover-foreground"
                  >
                    Password
                  </label>
                  <Input
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    placeholder="Enter your password"
                    name="password"
                    required
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
                <Button className="w-full">Login</Button>
              </form>
            )}

            {/* Forgot Password Link - Only show for teachers when not in reset mode */}
           
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Login;
