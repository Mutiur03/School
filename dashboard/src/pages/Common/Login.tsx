import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/useAuth';
import envPreferredRole from '@/lib/role';
import { Input } from '@/components/ui/input';
import axios from 'axios';
import { getErrorMessage } from '@/lib/utils';
import { Eye, EyeOff } from 'lucide-react';

type UserRole = 'admin' | 'teacher' | 'student' | 'super_admin';

const roleTabClass = (active: boolean) =>
  `flex-1 py-3 text-sm font-black rounded-md transition-[background-color,color,transform,box-shadow] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
    active
      ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-[1.02]'
      : 'text-muted-foreground hover:text-primary dark:hover:text-primary hover:bg-white/60 dark:hover:bg-slate-700/50'
  }`;

function Login() {
  const {
    loginAdmin,
    loginSuperAdmin,
    user,
    isAdmin,
    isSuperAdmin,
    isTeacher,
    isStudent,
    loginStudent,
    loginTeacher,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginID, setLoginID] = useState('');
  const [email, setEmail] = useState('');
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoginID, setResetLoginID] = useState('');
  const [resetCode, setResetCode] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [resetStep, setResetStep] = useState<'request' | 'verify' | 'newPassword'>('request');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const codeInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];
  const role: UserRole = location.pathname.includes('/super_admin')
    ? 'super_admin'
    : location.pathname.includes('/teacher')
      ? 'teacher'
      : location.pathname.includes('/student')
        ? 'student'
        : 'admin';

  const redirectTo = (location.state as any)?.from;

  useEffect(() => {
    if (user) {
      if (redirectTo && !redirectTo.includes('/login')) {
        navigate(redirectTo, { replace: true });
        return;
      }
      if (isSuperAdmin() && envPreferredRole === 'super_admin') navigate('/super_admin/dashboard');
      else if (isAdmin() && (!envPreferredRole || envPreferredRole === 'admin'))
        navigate('/admin/dashboard');
      else if (isTeacher() && (!envPreferredRole || envPreferredRole === 'teacher'))
        navigate('/teacher/dashboard');
      else if (isStudent() && (!envPreferredRole || envPreferredRole === 'student'))
        navigate('/student/dashboard');
      return;
    }
  }, [user, isAdmin, isSuperAdmin, isTeacher, isStudent, navigate]);

  useEffect(() => {
    const roleTitle =
      role === 'super_admin' ? 'Super Admin' : `${role.charAt(0).toUpperCase() + role.slice(1)}`;
    document.title = `${roleTitle} Login`;
    setLoginError('');
  }, [role]);

  const handlePasswordResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetting(true);
    setResetError('');
    setResetMessage('');

    try {
      const endpoint =
        role === 'student'
          ? '/api/auth/student/password-reset/request'
          : '/api/auth/teacher/password-reset/request';

      const payload = role === 'student' ? { login_id: resetLoginID } : { email: resetEmail };

      const response = await axios.post(endpoint, payload);

      if (response.data.success) {
        setResetMessage(response.data.data?.message || 'Reset code sent to your email/phone.');
        setResetStep('verify');
      } else {
        setResetError(response.data.message || 'Failed to send reset code');
      }
    } catch (error: any) {
      setResetError(getErrorMessage(error));
    } finally {
      setIsResetting(false);
    }
  };

  const handleCodeVerify = async () => {
    const code = resetCode.join('');
    if (code.length !== 6) {
      setResetError('Please enter all 6 digits');
      return;
    }

    setIsResetting(true);
    setResetError('');
    setResetMessage('');

    try {
      const endpoint =
        role === 'student'
          ? '/api/auth/student/password-reset/check-code'
          : '/api/auth/teacher/password-reset/check-code';

      const payload =
        role === 'student'
          ? { login_id: resetLoginID, code: code }
          : { email: resetEmail, code: code };

      const response = await axios.post(endpoint, payload);

      if (response.data.success) {
        setResetMessage('Code verified successfully! Please set your new password.');
        setResetStep('newPassword');
      } else {
        setResetError(response.data.message || 'Invalid verification code');
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
      setResetError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setResetError('Password must be at least 8 characters long');
      return;
    }

    setIsResetting(true);
    setResetError('');
    setResetMessage('');

    try {
      const endpoint =
        role === 'student'
          ? '/api/auth/student/password-reset/verify'
          : '/api/auth/teacher/password-reset/verify';

      const payload =
        role === 'student'
          ? { login_id: resetLoginID, code: resetCode.join(''), newPassword: newPassword }
          : { email: resetEmail, code: resetCode.join(''), newPassword: newPassword };

      const response = await axios.post(endpoint, payload);

      if (response.data.success) {
        setResetMessage('Password reset successfully! You can now login with your new password.');
        setTimeout(() => {
          setShowPasswordReset(false);
          setResetStep('request');
          setResetEmail('');
          setResetLoginID('');
          setResetCode(['', '', '', '', '', '']);
          setNewPassword('');
          setConfirmPassword('');
          setResetError('');
          setResetMessage('');
        }, 2000);
      } else {
        setResetError(response.data.message || 'Failed to reset password');
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
    if (e.key === 'Backspace' && !resetCode[index] && index > 0) {
      codeInputRefs[index - 1].current?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    const digitsOnly = pastedData.replace(/\D/g, '').slice(0, 6);

    if (digitsOnly.length > 0) {
      const newCode = [...resetCode];
      digitsOnly.split('').forEach((digit, i) => {
        if (i < 6) newCode[i] = digit;
      });
      setResetCode(newCode);

      // Focus the next empty or last filled input
      const nextIndex = Math.min(digitsOnly.length, 5);
      codeInputRefs[nextIndex].current?.focus();
    }
  };

  return (
    <div className="bg-background text-foreground relative flex min-h-screen items-center justify-center overflow-hidden p-4 transition-colors duration-500">
      {/* Decorative Background Blobs mapping to brand palette */}
      <div className="bg-primary/20 dark:bg-primary/10 pointer-events-none absolute top-[-15%] left-[-15%] h-[50%] w-[50%] animate-pulse rounded-full blur-[120px] duration-[10s]"></div>
      <div className="bg-secondary/20 dark:bg-secondary/10 pointer-events-none absolute right-[-15%] bottom-[-15%] h-[50%] w-[50%] animate-pulse rounded-full blur-[120px] duration-[8s]"></div>

      <div className="relative z-10 w-full max-w-md">
        <div className="animate-in fade-in slide-in-from-top mb-10 text-center duration-1000">
          <h1 className="mb-3 text-5xl font-black tracking-tighter sm:text-6xl">
            <span className="from-primary via-primary/80 to-secondary dark:from-primary dark:via-primary/70 dark:to-secondary bg-linear-to-br bg-clip-text text-transparent">
              School Sync
            </span>
          </h1>
          <div className="from-primary to-secondary mx-auto mb-4 h-1.5 w-16 rounded-full bg-linear-to-r shadow-[0_0_15px_rgba(15,23,42,0.2)]"></div>
          <p className="text-muted-foreground text-[10px] font-bold tracking-[0.2em] uppercase opacity-80">
            Professional Enterprise Intelligence
          </p>
        </div>

        <Card className="border-b-primary/20 overflow-hidden rounded-3xl border border-white/40 bg-white/95 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.1)] backdrop-blur-3xl transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-500 dark:border-white/5 dark:bg-gray-900/90 dark:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]">
          <CardContent className="px-6 pt-10 pb-8 sm:px-10">
            <div className="mb-8 flex justify-center">
              <div className="bg-muted/80 border-border flex w-full rounded-md border p-1.5 shadow-inner dark:border-slate-700/30 dark:bg-slate-800/50">
                {!showPasswordReset ? (
                  envPreferredRole ? (
                    <>
                      <button
                        // onClick={() => navigate("/admin/login")}
                        // className={`flex-1 py-3 text-sm font-black rounded-md transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300 ${location.pathname.includes("/admin")
                        //   ? "bg-primary text-white shadow-lg shadow-primary/30 scale-[1.02]"
                        //   : "text-muted-foreground hover:text-primary dark:hover:text-primary hover:bg-white/60 dark:hover:bg-slate-700/50"
                        //   }`}
                        className="text-muted-foreground hover:text-primary dark:hover:text-primary flex-1 rounded-md py-3 text-sm font-black transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300 hover:bg-white/60 dark:hover:bg-slate-700/50"
                      >
                        {/* Admin */}
                      </button>
                      <button
                        // onClick={() => navigate("/teacher/login")}
                        // className={`flex-1 py-3 text-sm font-black rounded-md transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300 ${location.pathname.includes("/teacher")
                        //   ? "bg-primary text-white shadow-lg shadow-primary/30 scale-[1.02]"
                        //   : "text-muted-foreground hover:text-primary dark:hover:text-primary hover:bg-white/60 dark:hover:bg-slate-700/50"
                        //   }`}
                        className="bg-primary shadow-primary/30 flex-1 scale-[1.02] rounded-md py-3 text-sm font-black text-white shadow-lg transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300"
                      >
                        {/* Teacher */}
                        {location.pathname.startsWith('/super_admin') && 'Super Admin'}
                        {location.pathname.startsWith('/admin') && 'Admin'}
                        {location.pathname.startsWith('/teacher') && 'Teacher'}
                        {location.pathname.startsWith('/student') && 'Student'}
                      </button>
                      <button
                        // onClick={() => navigate("/student/login")}
                        // className={`flex-1 py-3 text-sm font-black rounded-md transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300 ${location.pathname.includes("/student")
                        //   ? "bg-primary text-white shadow-lg shadow-primary/30 scale-[1.02]"
                        //   : "text-muted-foreground hover:text-primary dark:hover:text-primary hover:bg-white/60 dark:hover:bg-slate-700/50"
                        //   }`}
                        className="text-muted-foreground hover:text-primary dark:hover:text-primary flex-1 rounded-md py-3 text-sm font-black transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300 hover:bg-white/60 dark:hover:bg-slate-700/50"
                      >
                        {/* Student */}
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        to="/admin/login"
                        className={roleTabClass(location.pathname.includes('/admin'))}
                      >
                        Admin
                      </Link>
                      <Link
                        to="/teacher/login"
                        className={roleTabClass(location.pathname.includes('/teacher'))}
                      >
                        Teacher
                      </Link>
                      <Link
                        to="/student/login"
                        className={roleTabClass(location.pathname.includes('/student'))}
                      >
                        Student
                      </Link>
                    </>
                  )
                ) : (
                  <div className="text-primary dark:text-primary-foreground border-primary/10 dark:border-primary/20 w-full rounded-md border bg-white/50 py-3 text-center text-sm font-black tracking-wider shadow-sm dark:bg-slate-800/50">
                    RESETTING {role.toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            {showPasswordReset && (
              <div className="bg-primary/5 dark:bg-primary/10 border-primary/10 animate-in zoom-in-95 mb-10 rounded-md border p-5 text-center duration-500">
                <div className="mb-3 flex items-center justify-center">
                  <div className="bg-primary/10 dark:bg-primary/20 border-primary/10 mr-3 rounded-full border p-2 shadow-sm">
                    <svg
                      className="text-primary dark:text-primary h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2h2v-2l2.257-3.257A6 6 0 0119 9z"
                      />
                    </svg>
                  </div>
                  <span className="text-primary dark:text-primary-foreground/90 text-sm font-black tracking-widest uppercase">
                    Verify Identity
                  </span>
                </div>
                <p className="text-muted-foreground mx-auto max-w-[240px] text-xs leading-relaxed font-medium">
                  Enter your {role === 'student' ? 'Login ID' : 'email address'} to receive a
                  multi-factor verification code.
                </p>
              </div>
            )}

            {showPasswordReset ? (
              // Password Reset Form
              <div className="space-y-5">
                {resetMessage && (
                  <div
                    className="animate-in fade-in rounded-md border border-green-200 bg-green-50 p-4 duration-500 dark:border-green-800/30 dark:bg-green-900/20"
                    role="status"
                    aria-live="polite"
                  >
                    <div className="flex items-center">
                      <svg
                        className="mr-2 h-5 w-5 text-green-600 dark:text-green-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="text-sm font-medium text-green-800 dark:text-green-300">
                        {resetMessage}
                      </span>
                    </div>
                  </div>
                )}

                {resetError && (
                  <div
                    className="animate-in shake rounded-md border border-red-200 bg-red-50 p-4 duration-500 dark:border-red-800/30 dark:bg-red-900/20"
                    role="alert"
                    aria-live="assertive"
                  >
                    <div className="flex items-center">
                      <svg
                        className="mr-2 h-5 w-5 text-red-600 dark:text-red-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="text-sm font-medium text-red-800 dark:text-red-300">
                        {resetError}
                      </span>
                    </div>
                  </div>
                )}

                {resetStep === 'request' ? (
                  <form onSubmit={handlePasswordResetRequest} className="space-y-5">
                    <div className="space-y-2">
                      <label
                        htmlFor="reset-identity"
                        className="text-muted-foreground flex items-center text-xs font-black tracking-widest uppercase"
                      >
                        {role === 'student' ? (
                          <>
                            <svg
                              className="text-primary mr-2 h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                              />
                            </svg>
                            Login ID
                          </>
                        ) : (
                          <>
                            <svg
                              className="text-primary mr-2 h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                              />
                            </svg>
                            Email
                          </>
                        )}
                      </label>
                      {role === 'student' ? (
                        <Input
                          id="reset-identity"
                          type="text"
                          name="login_id"
                          placeholder="e.g., 10001…"
                          required
                          autoComplete="username"
                          spellCheck={false}
                          value={resetLoginID}
                          onChange={(e) => setResetLoginID(e.target.value)}
                          className="border-border dark:border-border/50 bg-input focus:border-primary focus:ring-primary/10 h-12 rounded-md transition-[border-color,box-shadow] focus:ring-4"
                        />
                      ) : (
                        <Input
                          id="reset-identity"
                          type="email"
                          name="email"
                          placeholder="e.g., user@example.com…"
                          required
                          autoComplete="email"
                          spellCheck={false}
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          className="border-border dark:border-border/50 bg-input focus:border-primary focus:ring-primary/10 h-12 rounded-md transition-[border-color,box-shadow] focus:ring-4"
                        />
                      )}
                    </div>
                    <Button
                      type="submit"
                      disabled={isResetting}
                      className="from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-primary/20 h-12 w-full transform rounded-md bg-linear-to-r font-black text-white shadow-lg transition-[transform,opacity] duration-300 active:scale-[0.98]"
                    >
                      {isResetting ? (
                        <div className="flex items-center justify-center">
                          <svg
                            className="mr-3 -ml-1 h-5 w-5 animate-spin text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Processing…
                        </div>
                      ) : (
                        'Send Reset Code'
                      )}
                    </Button>
                  </form>
                ) : resetStep === 'verify' ? (
                  <div className="space-y-6">
                    <div
                      className="flex justify-between gap-2 px-2"
                      onPaste={handlePaste}
                      role="group"
                      aria-label="Verification code"
                    >
                      {resetCode.map((digit, index) => (
                        <input
                          key={index}
                          ref={codeInputRefs[index]}
                          type="text"
                          inputMode="numeric"
                          autoComplete={index === 0 ? 'one-time-code' : 'off'}
                          spellCheck={false}
                          maxLength={1}
                          value={digit}
                          aria-label={`Digit ${index + 1}`}
                          onChange={(e) => handleCodeChange(index, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(index, e)}
                          className="border-border bg-input focus:border-primary focus:ring-primary/10 h-14 w-full rounded-md border-2 text-center text-2xl font-black shadow-sm transition-[border-color,box-shadow] outline-none focus:ring-4 dark:text-white"
                        />
                      ))}
                    </div>
                    <Button
                      onClick={handleCodeVerify}
                      disabled={isResetting}
                      className="from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-primary/20 h-12 w-full transform rounded-md bg-linear-to-r font-black text-white shadow-lg transition-[transform,opacity] duration-300 active:scale-[0.98]"
                    >
                      {isResetting ? 'Verifying…' : 'Verify Code'}
                    </Button>
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => setResetStep('request')}
                        className="text-muted-foreground hover:text-primary text-xs font-bold tracking-widest uppercase transition-colors"
                      >
                        Resend Code
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handlePasswordResetVerify} className="space-y-4">
                    <div className="space-y-2">
                      <label
                        htmlFor="new-password"
                        className="text-muted-foreground flex items-center text-xs font-black tracking-widest uppercase"
                      >
                        New Password
                      </label>
                      <div className="relative">
                        <Input
                          id="new-password"
                          type={showNewPassword ? 'text' : 'password'}
                          name="new-password"
                          placeholder="Minimum 8 characters…"
                          required
                          autoComplete="new-password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="border-border dark:border-border/50 bg-input focus:border-primary focus:ring-primary/10 h-12 rounded-md pr-10 transition-[border-color,box-shadow] focus:ring-4"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                          className="text-muted-foreground hover:text-primary focus-visible:ring-primary absolute top-1/2 right-3 -translate-y-1/2 rounded transition-colors focus:outline-none focus-visible:ring-2"
                        >
                          {showNewPassword ? (
                            <EyeOff className="h-5 w-5" aria-hidden="true" />
                          ) : (
                            <Eye className="h-5 w-5" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor="confirm-password"
                        className="text-muted-foreground flex items-center text-xs font-black tracking-widest uppercase"
                      >
                        Confirm Password
                      </label>
                      <div className="relative">
                        <Input
                          id="confirm-password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          name="confirm-password"
                          placeholder="Confirm your new password…"
                          required
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="border-border dark:border-border/50 bg-input focus:border-primary focus:ring-primary/10 h-12 rounded-md pr-10 transition-[border-color,box-shadow] focus:ring-4"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                          className="text-muted-foreground hover:text-primary focus-visible:ring-primary absolute top-1/2 right-3 -translate-y-1/2 rounded transition-colors focus:outline-none focus-visible:ring-2"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-5 w-5" aria-hidden="true" />
                          ) : (
                            <Eye className="h-5 w-5" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      disabled={isResetting}
                      className="from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-primary/20 h-12 w-full transform rounded-md bg-linear-to-r font-black text-white shadow-lg transition-[transform,opacity] duration-300 active:scale-[0.98]"
                    >
                      {isResetting ? (
                        'Updating…'
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <svg
                            className="h-5 w-5 opacity-80"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.5}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          <span>Update Password</span>
                        </div>
                      )}
                    </Button>
                  </form>
                )}

                <div className="mt-8 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordReset(false);
                      setResetStep('request');
                      setResetEmail('');
                      setResetLoginID('');
                      setResetCode(['', '', '', '', '', '']);
                      setNewPassword('');
                      setConfirmPassword('');
                      setResetMessage('');
                      setResetError('');
                    }}
                    className="text-primary dark:text-primary flex items-center justify-center text-xs font-bold tracking-widest uppercase transition-colors hover:opacity-80"
                  >
                    <svg
                      className="mr-2 h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M10 19l-7-7m0 0l7-7m-7 7h18"
                      />
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
                  setLoginError('');

                  // Client-side validation
                  if (
                    location.pathname.includes('/super_admin') ||
                    role === 'super_admin' ||
                    location.pathname.includes('/teacher')
                  ) {
                    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                    if (!emailRegex.test(email)) {
                      setLoginError('Please enter a valid email address.');
                      return;
                    }
                  } else if (location.pathname.includes('/student')) {
                    if (!/^\d{6}$/.test(loginID)) {
                      setLoginError('Student ID must be exactly 6 digits.');
                      return;
                    }
                  } else {
                    if (!username.trim()) {
                      setLoginError('Username is required.');
                      return;
                    }
                  }

                  try {
                    if (location.pathname.includes('/super_admin') || role === 'super_admin') {
                      await loginSuperAdmin(email, password);
                    } else if (location.pathname.includes('/teacher')) {
                      await loginTeacher(email, password);
                    } else if (location.pathname.includes('/student')) {
                      await loginStudent(loginID, password);
                    } else {
                      await loginAdmin(username, password);
                    }
                    const destination =
                      redirectTo ||
                      (role === 'super_admin'
                        ? '/super_admin/dashboard'
                        : role === 'admin'
                          ? '/admin/dashboard'
                          : role === 'teacher'
                            ? '/teacher/dashboard'
                            : '/student/dashboard');
                    navigate(destination, { replace: true });
                  } catch (error) {
                    setLoginError(getErrorMessage(error));
                  }
                }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <label
                    htmlFor="login-identity"
                    className="text-muted-foreground flex items-center text-xs font-black tracking-widest uppercase"
                  >
                    {location.pathname.includes('/super_admin') ||
                    role === 'super_admin' ||
                    location.pathname.includes('/teacher') ? (
                      <>
                        <svg
                          className="text-primary mr-2 h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                        Email Address
                      </>
                    ) : location.pathname.includes('/student') ? (
                      <>
                        <svg
                          className="text-primary mr-2 h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                        Student ID
                      </>
                    ) : (
                      <>
                        <svg
                          className="text-primary mr-2 h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                        Username
                      </>
                    )}
                  </label>
                  {location.pathname.includes('/super_admin') ||
                  role === 'super_admin' ||
                  location.pathname.includes('/teacher') ? (
                    <Input
                      id="login-identity"
                      type="email"
                      name="email"
                      placeholder={
                        location.pathname.includes('/super_admin') || role === 'super_admin'
                          ? 'e.g., superadmin@example.com…'
                          : 'e.g., teacher@example.com…'
                      }
                      required
                      autoComplete="email"
                      spellCheck={false}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="border-border dark:border-border/50 bg-input focus:border-primary focus:ring-primary/10 h-12 rounded-md transition-[border-color,box-shadow] focus:ring-4"
                    />
                  ) : location.pathname.includes('/student') ? (
                    <Input
                      id="login-identity"
                      type="text"
                      name="login_id"
                      placeholder="e.g., 220101…"
                      required
                      pattern="\d{6}"
                      title="Login ID must be exactly 6 digits"
                      maxLength={6}
                      minLength={6}
                      autoComplete="username"
                      spellCheck={false}
                      inputMode="numeric"
                      value={loginID}
                      onChange={(e) => setLoginID(e.target.value)}
                      className="border-border dark:border-border/50 bg-input focus:border-primary focus:ring-primary/10 h-12 rounded-md transition-[border-color,box-shadow] focus:ring-4"
                    />
                  ) : (
                    <Input
                      id="login-identity"
                      type="text"
                      name="username"
                      placeholder="e.g., admin_user…"
                      required
                      autoComplete="username"
                      spellCheck={false}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="border-border dark:border-border/50 bg-input focus:border-primary focus:ring-primary/10 h-12 rounded-md transition-[border-color,box-shadow] focus:ring-4"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="login-password"
                    className="text-muted-foreground flex items-center text-xs font-black tracking-widest uppercase"
                  >
                    <svg
                      className="text-primary mr-2 h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2h2v-2l2.257-3.257A6 6 0 0119 9z"
                      />
                    </svg>
                    Secure Password
                  </label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type={showLoginPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      name="password"
                      autoComplete="current-password"
                      required
                      className="border-border dark:border-border/50 bg-input focus:border-primary focus:ring-primary/10 h-12 rounded-md pr-10 transition-[border-color,box-shadow] focus:ring-4 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                      className="text-muted-foreground hover:text-primary focus-visible:ring-primary absolute top-1/2 right-3 -translate-y-1/2 rounded transition-colors focus:outline-none focus-visible:ring-2"
                    >
                      {showLoginPassword ? (
                        <EyeOff className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <Eye className="h-5 w-5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
                {!showPasswordReset &&
                  (location.pathname.includes('/teacher') ||
                    location.pathname.includes('/student')) && (
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => setShowPasswordReset(true)}
                        className="text-primary hover:text-primary/80 text-[10px] font-black tracking-widest uppercase transition-colors"
                      >
                        Forgot Access Details?
                      </button>
                    </div>
                  )}
                {loginError && (
                  <div
                    className="animate-in fade-in mb-4 rounded-md border border-red-200 bg-red-50 p-3 duration-300 dark:border-red-800/30 dark:bg-red-900/20"
                    role="alert"
                    aria-live="assertive"
                  >
                    <div className="flex items-center gap-2">
                      <svg
                        className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="text-xs font-medium text-red-800 dark:text-red-300">
                        {loginError}
                      </span>
                    </div>
                  </div>
                )}
                <Button className="from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-primary-foreground shadow-primary/20 flex h-12 w-full transform items-center justify-center gap-2 rounded-md bg-linear-to-r font-black shadow-lg transition-[transform,opacity] duration-300 active:scale-[0.98]">
                  <span>Sign In</span>
                  <svg
                    className="h-5 w-5 opacity-80"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                    />
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
