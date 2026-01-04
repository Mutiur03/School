import { useEffect } from "react";
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUnifiedAuth } from "@/context/useUnifiedAuth";
import ThemeChange from "@/components/ThemeChange";

type UserRole = "admin" | "teacher" | "student";

function Login() {
  const { loginAdmin, user, loading, isAdmin, isTeacher, isStudent, loginStudent, loginTeacher } = useUnifiedAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginID, setLoginID] = useState("");
  const [email, setEmail] = useState("");
  const role: UserRole = location.pathname.includes("/teacher") ? "teacher" : location.pathname.includes("/student") ? "student" : "admin";

  useEffect(() => {
    if (user) {
      if (isAdmin()) navigate("/admin/dashboard");
      else if (isTeacher()) navigate("/teacher/dashboard");
      else if (isStudent()) navigate("/student/dashboard");
      return;
    }
  }, [user, isAdmin, isTeacher, isStudent, navigate]);

  if (user) {
    return null;
  }

  if (loading) {
    return null;
  }
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div
        className="w-full max-w-md"
      >
        <Card className="shadow-2xl  relative rounded-2xl">
          <ThemeChange vars={"top-0 absolute right-0"} />

          <div>
            <CardContent className="p-6">
              <h2 className="text-2xl font-semibold text-center mb-6">
                {role.charAt(0).toUpperCase() + role.slice(1)} Login
              </h2>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (location.pathname.includes("/teacher")) {
                    await loginTeacher(email, password);
                  } else if (location.pathname.includes("/student")) {
                    await loginStudent(loginID, password);
                  } else
                    await loginAdmin(username, password);
                  if (role === "admin") navigate("/admin/dashboard");
                  else if (role === "teacher") navigate("/teacher/dashboard");
                  else if (role === "student") navigate("/student/dashboard");
                }}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <label
                    htmlFor=""
                    className="text-sm font-medium text-popover-foreground"
                  >
                    {location.pathname.includes("/teacher") ? "Email" : location.pathname.includes("/student") ? "Login ID" : "Username"}
                  </label>
                  {location.pathname.includes("/teacher") ? (<input
                    type="email"
                    placeholder="Enter your Email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-popover text-popover-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent "
                  />) : location.pathname.includes("/student") ? (<input
                    type="number"
                    placeholder="Enter your Login ID"
                    required
                    value={loginID}
                    onChange={(e) => setLoginID(e.target.value)}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-popover text-popover-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent "
                  />) : (<input
                    type="text"
                    placeholder="Enter your Username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-popover text-popover-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent "
                  />)}

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
              {/* <div className="mt-4 text-center text-sm text-muted-foreground">
                <p>Access other login pages:
                  <a href="/admin/login" className="ml-1 hover:underline font-medium">Admin</a>
                  {" | "}
                  <a href="/teacher/login" className="hover:underline font-medium">Teacher</a>
                  {" | "}
                  <a href="/student/login" className="hover:underline font-medium">Student</a>
                </p>
              </div> */}
            </CardContent>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default Login;
